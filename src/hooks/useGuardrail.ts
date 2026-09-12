import { useEffect, useState } from 'react';
import { useMockData } from './useMockData';
import type { CreditOffer, Customer } from '../lib/types';

/**
 * Hook to evaluate whether a given customer should be presented with an emergency credit offer.
 * It loads static credit offer definitions from `data/mock/creditOffers.json` and matches
 * the customer's stress score (derived from existing data) against the configured thresholds.
 */
export function useGuardrail(customer: Customer | null) {
  const { data: offers, loading } = useMockData<CreditOffer[]>('creditOffers.json');
  const [eligibleOffer, setEligibleOffer] = useState<CreditOffer | null>(null);

  useEffect(() => {
    if (!customer || loading || !offers) {
      setEligibleOffer(null);
      return;
    }
    const stressScore = (customer?.monthlyExpense ?? 0) / (customer?.monthlyIncome ?? 1) * 100;
    if (stressScore > 70) {
      const specific = offers.find(o => o.customerId === customer.customerId);
      setEligibleOffer(specific ?? offers[0] ?? null);
    } else {
      setEligibleOffer(null);
    }
  }, [customer, offers, loading]);

  return { eligibleOffer, loading };
}
