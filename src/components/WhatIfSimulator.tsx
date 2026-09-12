"use client";

import { useState } from "react";
import { Sliders, RefreshCw, AlertCircle } from "lucide-react";
import { Badge } from "./ui/badge";

export function WhatIfSimulator() {
  const [income, setIncome] = useState(50000);
  const [spending, setSpending] = useState(30000);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simResult, setSimResult] = useState<string | null>(null);

  const handleSimulate = () => {
    setIsSimulating(true);
    // Simulate a brief delay to mimic an API call
    setTimeout(() => {
      if (spending > income) {
        setSimResult("High stress detected. Wellness gate suppresses credit recommendations. Consider emergency fund options.");
      } else if (income - spending > 20000) {
        setSimResult("Low risk profile. Recommend Premium Wealth Credit Card with higher limits.");
      } else {
        setSimResult("Moderate risk. Recommend standard Personal Loan based on current debt-to-income ratio.");
      }
      setIsSimulating(false);
    }, 800);
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sliders className="h-5 w-5 text-accent" />
          <h2 className="text-lg font-semibold text-fg">"What-If" Sandbox</h2>
        </div>
        <Badge variant="outline">Simulation</Badge>
      </div>
      
      <p className="mb-6 text-sm text-fg-subtle">
        Adjust customer signals to preview how the recommendation engine and risk models react in real-time.
      </p>

      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-fg">Monthly Income (₹)</label>
          <input
            type="range"
            min="10000"
            max="150000"
            step="5000"
            value={income}
            onChange={(e) => setIncome(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 text-right text-xs font-semibold text-fg">₹ {income.toLocaleString()}</div>
        </div>
        
        <div>
          <label className="mb-1 block text-sm font-medium text-fg">Monthly Spending (₹)</label>
          <input
            type="range"
            min="5000"
            max="150000"
            step="5000"
            value={spending}
            onChange={(e) => setSpending(Number(e.target.value))}
            className="w-full"
          />
          <div className="mt-1 text-right text-xs font-semibold text-fg">₹ {spending.toLocaleString()}</div>
        </div>

        <button
          onClick={handleSimulate}
          disabled={isSimulating}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent/10 py-2.5 font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-50"
        >
          {isSimulating ? <RefreshCw className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Run Simulation
        </button>

        {simResult && (
          <div className="mt-4 animate-fade-up rounded-lg border border-accent/20 bg-accent/5 p-4 text-sm text-fg">
            <div className="mb-2 flex items-center gap-2 text-accent">
              <AlertCircle className="h-4 w-4" />
              <span className="font-semibold">Simulated Outcome</span>
            </div>
            <p className="leading-relaxed text-fg-muted">{simResult}</p>
          </div>
        )}
      </div>
    </div>
  );
}
