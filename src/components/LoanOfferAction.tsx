"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { FileText, Loader2, ShieldOff } from "lucide-react";

/**
 * Entry point to the loan journey (ADR-033).
 *
 * The refusal path is the interesting one: when the wellness gate is closed the
 * server declines to issue a Key Facts Statement at all, and this component
 * shows why rather than hiding the button. A customer who is being protected
 * should be able to see that they are being protected.
 */
export function LoanOfferAction({
  customerId,
  product,
  asOf,
}: {
  customerId: string;
  product: string;
  asOf?: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [refusal, setRefusal] = useState<{ message: string; reasonTrace?: string[] } | null>(null);

  const request = async () => {
    setBusy(true);
    setRefusal(null);
    try {
      const query = asOf ? `?now=${encodeURIComponent(asOf)}` : "";
      const res = await fetch(`/api/customers/${customerId}/loan-offer${query}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
      });
      const data = await res.json();

      if (data.refused) {
        setRefusal({ message: data.message, reasonTrace: data.reasonTrace });
      } else if (data.offer) {
        router.push(`/loan/${encodeURIComponent(data.offer.proposalNo)}`);
      }
    } catch {
      setRefusal({ message: "Could not reach the lending service." });
    } finally {
      setBusy(false);
    }
  };

  if (refusal) {
    return (
      <div className="flex gap-3 rounded-md border border-line-strong bg-surface-2 p-3">
        <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
        <div className="text-xs leading-relaxed">
          <span className="font-semibold">No Key Facts Statement was issued.</span> {refusal.message}
          {refusal.reasonTrace && refusal.reasonTrace.length > 0 && (
            <ul className="mt-2 space-y-1 text-fg-muted">
              {refusal.reasonTrace.map((r, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-fg-subtle">—</span>
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={request}
      disabled={busy}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-line-strong px-3 py-2.5 text-xs font-medium transition-colors hover:bg-surface-2 disabled:opacity-40"
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileText className="h-3.5 w-3.5" />}
      See the Key Facts Statement
    </button>
  );
}
