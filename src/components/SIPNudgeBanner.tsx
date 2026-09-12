import React from 'react';
import { useRecommendation } from '../../hooks/useRecommendation';
import { useAuth } from '../../hooks/useAuth'; // assuming an auth hook exists
import type { SipNudge } from '../../lib/types';

/**
 * SIP Nudge Banner displayed on the Dashboard.
 * Shows a personalized suggestion for setting up a Systematic Investment Plan.
 */
export const SIPNudgeBanner: React.FC = () => {
  const { user } = useAuth(); // get current logged‑in customer
  const { sipRecommendation, loading } = useRecommendation(user);

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
