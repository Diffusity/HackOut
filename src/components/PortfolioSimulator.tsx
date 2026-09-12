import React from 'react';
import { useInvestmentSimulator } from '../../hooks/useInvestmentSimulator';
import type { Customer } from '../../lib/types';

/**
 * Simple portfolio simulator UI.
 * Shows allocation breakdown and a mock projected return.
 */
export const PortfolioSimulator: React.FC<{ customer: Customer | null }> = ({ customer }) => {
  const { result, loading } = useInvestmentSimulator(customer);

  if (loading) return <p className="text-fg-muted">Calculating portfolio…</p>;
  if (!result) return <p className="text-fg-muted">No data available.</p>;

  return (
    <div className="bg-glass backdrop-blur-md p-6 rounded-xl shadow-lg text-white">
      <h2 className="text-xl font-semibold mb-4">Portfolio Simulation</h2>
      <ul className="mb-4 space-y-2">
        {result.allocations.map((a, idx) => (
          <li key={idx} className="flex justify-between">
            <span>{a.assetClass}</span>
            <span>{a.percentage}%</span>
          </li>
        ))}
      </ul>
      <p className="mb-2">Projected Annual Return: {result.projectedReturnAnnualPct}%</p>
      <p>Risk Score: {result.riskScore}</p>
    </div>
  );
};
