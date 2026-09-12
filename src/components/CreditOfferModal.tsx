import React, { useState } from 'react';
import { useGuardrail } from '../hooks/useGuardrail';
import type { CreditOffer, Customer } from '../lib/types';
import { AlertCircle, X } from 'lucide-react';

/**
 * Modal that appears when the customer's stress score exceeds the threshold.
 * It displays the first eligible credit offer from the mock data.
 */
export const CreditOfferModal: React.FC<{ customer: Customer | null }> = ({ customer }) => {
  const { eligibleOffer, loading } = useGuardrail(customer);
  const [isOpen, setIsOpen] = useState(false);

  // Open the modal when an eligible offer becomes available
  React.useEffect(() => {
    if (eligibleOffer && !loading) {
      setIsOpen(true);
    }
  }, [eligibleOffer, loading]);

  if (!isOpen || !eligibleOffer) return null;

  const { offerAmount, interestRate, tenureMonths, terms } = eligibleOffer as CreditOffer;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md animate-fade-up rounded-xl border border-line bg-surface p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-rose-500" />
            <h2 className="text-lg font-semibold text-fg">Emergency Credit Offer</h2>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded p-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mb-4 text-sm leading-relaxed text-fg-muted">
          We noticed you might need quick cash. Here’s a tailored offer for you:
        </p>
        <div className="mb-4 space-y-3 rounded-lg border border-line bg-surface-2 p-4 text-sm">
          <div className="flex justify-between">
            <span className="text-fg-subtle">Amount</span>
            <span className="font-semibold text-fg">₹{offerAmount.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-subtle">Interest Rate</span>
            <span className="font-medium text-fg">{interestRate}% p.a.</span>
          </div>
          <div className="flex justify-between">
            <span className="text-fg-subtle">Tenure</span>
            <span className="font-medium text-fg">{tenureMonths} months</span>
          </div>
        </div>
        <p className="mb-6 text-[11px] italic leading-relaxed text-fg-subtle">{terms}</p>
        <div className="flex justify-end gap-3">
          <button
            className="rounded-lg border border-line px-4 py-2 text-sm font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            onClick={() => setIsOpen(false)}
          >
            Decline
          </button>
          <button
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-accent-fg transition-colors hover:opacity-90"
            onClick={() => setIsOpen(false)}
          >
            Accept Offer
          </button>
        </div>
      </div>
    </div>
  );
};
