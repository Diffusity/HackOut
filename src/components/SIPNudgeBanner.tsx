import React from 'react';
import { useRecommendation } from '../hooks/useRecommendation';
import type { SipNudge, Customer } from '../lib/types';

export const SIPNudgeBanner: React.FC<{ customer: Customer | null }> = ({ customer }) => {
  const { sipRecommendation, loading } = useRecommendation(customer);

  if (loading || !sipRecommendation) {
    return null;
  }

  const { suggestedSipAmount, message } = sipRecommendation as SipNudge;

  return (
    <section className="bg-glass backdrop-blur-md p-4 rounded-xl shadow-lg text-white mb-4">
      <h2 className="text-xl font-semibold mb-2">💡 SIP Recommendation</h2>
      <p className="mb-3">{message}</p>
      <div className="flex items-center gap-4">
        <span className="text-2xl font-bold">₹{suggestedSipAmount.toLocaleString()}</span>
        <button className="bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-4 rounded transition-colors">
          Set Up SIP
        </button>
      </div>
    </section>
  );
};
