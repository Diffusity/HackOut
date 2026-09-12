import React from 'react';
import { useRecommendation } from '../hooks/useRecommendation';
import type { SipNudge, Customer } from '../lib/types';
import { Lightbulb } from 'lucide-react';

export const SIPNudgeBanner: React.FC<{ customer: Customer | null }> = ({ customer }) => {
  const { sipRecommendation, loading } = useRecommendation(customer);

  if (loading || !sipRecommendation) {
    return null;
  }

  const { suggestedSipAmount, message } = sipRecommendation as SipNudge;

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm mb-5 animate-fade-up">
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="h-5 w-5 text-accent" />
        <h2 className="text-sm font-semibold tracking-tight text-fg">SIP Recommendation</h2>
      </div>
      <p className="mb-4 text-sm leading-relaxed text-fg-muted">{message}</p>
      <div className="flex items-center justify-between">
        <span className="text-2xl font-bold text-fg">₹{suggestedSipAmount.toLocaleString()}</span>
        <button className="rounded-lg bg-accent/10 px-4 py-2 text-sm font-medium text-accent transition-colors hover:bg-accent/20">
          Set Up SIP
        </button>
      </div>
    </div>
  );
};
