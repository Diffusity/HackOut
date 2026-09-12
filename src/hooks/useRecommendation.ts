import { useEffect, useState } from 'react';
import { useMockData } from './useMockData';
import type { SipNudge, PortfolioAllocation, Customer } from '../lib/types';

/**
 * Hook to compute product recommendations for a given customer.
 * It loads static SIP nudge data and, if needed, market strategy allocation.
 * For the demo, the logic is simple rule‑based matching based on the customer's profile.
 */
export function useRecommendation(customer: Customer | null) {
  const { data: sipNudges, loading: sipLoading } = useMockData<SipNudge[]>('src/data/mock/sipNudge.json');
  const { data: marketStrategy, loading: strategyLoading } = useMockData<PortfolioAllocation[]>('src/data/mock/marketStrategy.json');

  const [sipRecommendation, setSipRecommendation] = useState<SipNudge | null>(null);
  const [allocation, setAllocation] = useState<PortfolioAllocation[]>([]);

  // Determine SIP recommendation based on simple criteria (e.g., income tier)
  useEffect(() => {
    if (!customer || sipLoading || !sipNudges) {
      setSipRecommendation(null);
      return;
    }
    // Find a matching nudge by segment or fallback to first
    const match = sipNudges.find(n => n.customerId === customer.customerId) ?? sipNudges[0];
    setSipRecommendation(match);
  }, [customer, sipNudges, sipLoading]);

  // Provide static allocation data for the portfolio simulator
  useEffect(() => {
    if (strategyLoading || !marketStrategy) {
      setAllocation([]);
      return;
    }
    setAllocation(marketStrategy);
  }, [marketStrategy, strategyLoading]);

  return {
    sipRecommendation,
    allocation,
    loading: sipLoading || strategyLoading,
  };
}
