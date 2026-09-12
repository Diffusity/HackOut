import { useState, useEffect } from 'react';
import { useMockData } from './useMockData';
import type { Customer, PortfolioAllocation, PortfolioSimulationResult } from '../lib/types';

/**
 * Simple client‑side investment simulator.
 * It loads the static market allocation (`marketStrategy.json`) and pretends to
 * calculate a projected annual return based on a hard‑coded mock rate.
 */
export function useInvestmentSimulator(customer: Customer | null) {
  const { data: marketStrategy, loading } = useMockData<PortfolioAllocation[]>('marketStrategy.json');
  const [result, setResult] = useState<PortfolioSimulationResult | null>(null);

  useEffect(() => {
    if (!customer || loading || !marketStrategy) {
      setResult(null);
      return;
    }
    // Mock calculation: assume 8% annual return on the total allocation.
    const projectedReturnAnnualPct = 8;
    const riskScore = Math.round(Math.random() * 100);
    setResult({
      customerId: customer.customerId,
      allocations: marketStrategy,
      projectedReturnAnnualPct,
      riskScore,
    });
  }, [customer, marketStrategy, loading]);

  return { result, loading };
}
