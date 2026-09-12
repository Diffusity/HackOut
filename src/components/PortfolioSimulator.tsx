import React from 'react';
import { useInvestmentSimulator } from '../hooks/useInvestmentSimulator';
import type { Customer } from '../lib/types';
import { PieChart, Loader2 } from 'lucide-react';

/**
 * Simple portfolio simulator UI.
 * Shows allocation breakdown and a mock projected return.
 */
export const PortfolioSimulator: React.FC<{ customer: Customer | null }> = ({ customer }) => {
  const { result, loading } = useInvestmentSimulator(customer);

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center rounded-xl border border-line bg-surface">
        <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-xl border border-line bg-surface p-5 text-sm text-fg-muted">
        No portfolio simulation data available.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <PieChart className="h-5 w-5 text-accent" />
        <h2 className="text-sm font-semibold tracking-tight text-fg">Portfolio Simulation</h2>
      </div>
      
      <div className="mb-5 space-y-3 rounded-lg border border-line bg-surface-2 p-4">
        {result.allocations.map((a, idx) => (
          <div key={idx} className="flex justify-between text-sm">
            <span className="text-fg-muted">{a.assetClass}</span>
            <span className="font-medium text-fg">{a.percentage}%</span>
          </div>
        ))}
      </div>

      <div className="flex justify-between border-t border-line pt-4 text-sm">
        <div>
          <span className="block text-[10px] uppercase tracking-wider text-fg-subtle">Risk Score</span>
          <span className="font-semibold text-fg">{result.riskScore}/10</span>
        </div>
        <div className="text-right">
          <span className="block text-[10px] uppercase tracking-wider text-fg-subtle">Projected Return</span>
          <span className="font-semibold text-emerald-500">+{result.projectedReturnAnnualPct}%</span>
        </div>
      </div>
    </div>
  );
};
