"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Loader2 } from "lucide-react";

export interface Counterfactual {
  feature: string;
  label: string;
  currentValue: string;
  requiredValue: string;
  direction: "increase" | "decrease";
  resultingProduct: string;
  resultingProductName: string;
  narrative: string;
}

const ASKABLE = ["HOME_LOAN", "CREDIT_CARD", "SIP", "PERSONAL_LOAN"];
const ASKABLE_LABELS: Record<string, string> = {
  HOME_LOAN: "Home Loan",
  CREDIT_CARD: "Credit Card",
  SIP: "SIP",
  PERSONAL_LOAN: "Personal Loan",
};

/**
 * Counterfactual explanations (ADR-026). Regulators require the principal
 * reasons for an adverse decision AND a route to recourse; because every
 * decision function in this app is pure, we can compute the exact minimum
 * change that flips the outcome rather than approximate it.
 */
export function DecisionExplainer({
  customerId,
  counterfactuals,
  asOf,
}: {
  customerId: string;
  counterfactuals: Counterfactual[];
  asOf?: string | null;
}) {
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const ask = async (product: string) => {
    setAsked(product);
    setLoading(true);
    setAnswer(null);
    try {
      const query = new URLSearchParams({ product });
      if (asOf) query.set("now", asOf);
      const res = await fetch(`/api/customers/${customerId}/why-not?${query}`);
      const data = await res.json();
      setAnswer(data.message ?? "No explanation available.");
    } catch {
      setAnswer("Could not reach the explanation service.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>What would change this</CardTitle>
          <Badge variant="muted">Counterfactual</Badge>
        </div>
        <p className="text-xs leading-relaxed text-fg-muted">
          The smallest change to each factor that would produce a different recommendation —
          computed by re-running the real decision engine, not estimated.
        </p>
      </CardHeader>

      <CardContent className="space-y-4">
        {counterfactuals.length === 0 ? (
          <p className="text-xs text-fg-muted">
            No single change to any one factor would alter this recommendation.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {counterfactuals.map((cf) => (
              <li key={cf.feature} className="rounded-md border border-line bg-surface-2 p-3">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-xs font-medium capitalize">{cf.label}</span>
                  <span className="tnum shrink-0 text-xs text-fg-muted">
                    {cf.currentValue} <span className="text-fg-subtle">&rarr;</span>{" "}
                    <span className="font-semibold text-fg">{cf.requiredValue}</span>
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">{cf.narrative}</p>
              </li>
            ))}
          </ul>
        )}

        <div className="border-t border-line pt-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
            Why was I not offered&hellip;
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ASKABLE.map((product) => (
              <button
                key={product}
                type="button"
                onClick={() => ask(product)}
                className={`rounded border px-2 py-1 text-xs transition-colors ${
                  asked === product
                    ? "border-transparent bg-accent text-accent-fg"
                    : "border-line text-fg-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {ASKABLE_LABELS[product]}
              </button>
            ))}
          </div>

          {(loading || answer) && (
            <div className="animate-fade-up mt-3 rounded-md bg-surface-2 p-3 text-xs leading-relaxed">
              {loading ? (
                <span className="flex items-center gap-2 text-fg-muted">
                  <Loader2 className="h-3 w-3 animate-spin" /> Searching the decision space&hellip;
                </span>
              ) : (
                answer
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
