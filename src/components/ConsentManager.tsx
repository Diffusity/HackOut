"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Loader2 } from "lucide-react";

type Consent = { transactions: boolean; location: boolean; spendCategories: boolean };

const SCOPES: { key: keyof Consent; title: string; purpose: string; effect: string }[] = [
  {
    key: "transactions",
    title: "Transaction history",
    purpose: "To work out income, spending and savings patterns.",
    effect: "Without it we cannot make any recommendation at all.",
  },
  {
    key: "spendCategories",
    title: "Spend categories",
    purpose: "To tell an EMI from a grocery bill.",
    effect: "Without it recommendations continue, with lower confidence.",
  },
  {
    key: "location",
    title: "Location",
    purpose: "To match festival timing and local branch support.",
    effect: "Without it timing becomes less precise.",
  },
];

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-5 w-9 shrink-0 rounded-full border transition-colors ${
        checked ? "border-transparent bg-accent" : "border-line-strong bg-surface-2"
      }`}
    >
      <span
        className={`absolute top-[3px] h-3 w-3 rounded-full transition-all ${
          checked ? "left-[19px] bg-accent-fg" : "left-[3px] bg-fg-subtle"
        }`}
      />
    </button>
  );
}

/**
 * Consent is a first-class control, not a checkbox on a signup page
 * (ADR-014). Each scope states its purpose and what is lost by withholding it,
 * which is what purpose limitation under the DPDP Act actually asks for, and
 * every change is written to the audit ledger.
 */
export function ConsentManager({
  customerId,
  onConsentChange,
}: {
  customerId: string;
  onConsentChange: () => void;
}) {
  const [consent, setConsent] = useState<Consent>({
    transactions: true,
    location: true,
    spendCategories: true,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function fetchConsent() {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers/${customerId}/consent`);
        if (res.ok && !cancelled) setConsent(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchConsent();
    return () => {
      cancelled = true;
    };
  }, [customerId]);

  const update = async (next: Consent) => {
    setConsent(next);
    setSaving(true);
    try {
      await fetch(`/api/customers/${customerId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: next }),
      });
      onConsentChange();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const grantedCount = Object.values(consent).filter(Boolean).length;

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Privacy controls</CardTitle>
          {saving ? (
            <Loader2 className="h-3 w-3 animate-spin text-fg-subtle" />
          ) : (
            <Badge variant="muted">{grantedCount}/3 granted</Badge>
          )}
        </div>
        <p className="text-xs leading-relaxed text-fg-muted">
          Each permission is separate, states its purpose, and can be withdrawn at any time. Every
          change is written to the audit ledger.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {SCOPES.map((scope) => (
          <div key={scope.key} className="rounded-md border border-line bg-surface-2 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-medium">{scope.title}</div>
                <p className="mt-0.5 text-xs text-fg-muted">{scope.purpose}</p>
              </div>
              <Toggle
                checked={consent[scope.key]}
                onChange={() => update({ ...consent, [scope.key]: !consent[scope.key] })}
                label={`Allow ${scope.title}`}
              />
            </div>
            {!consent[scope.key] && (
              <p className="animate-fade-up mt-2 border-t border-line pt-2 text-xs text-fg-muted">
                {scope.effect}
              </p>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={() => update({ transactions: false, location: false, spendCategories: false })}
          className="w-full rounded-md border border-line px-3 py-2 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
        >
          Withdraw all consent
        </button>
      </CardContent>
    </Card>
  );
}
