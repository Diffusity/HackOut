"use client";

import { useState } from "react";
import { Upload, Play, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { Badge } from "./ui/badge";

export function ModelTrainer() {
  const [csvData, setCsvData] = useState<string>(
    "income,spending,debtToIncome,missedPayments,target\n60000,45000,0.3,0,0\n55000,52000,0.6,1,1\n80000,30000,0.2,0,0\n45000,48000,0.8,2,1\n70000,40000,0.4,0,0"
  );
  const [isTraining, setIsTraining] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrain = async () => {
    setIsTraining(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/ml/train", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvData }),
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to train");
      }
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsTraining(false);
    }
  };

  return (
    <div className="rounded-xl border border-line bg-surface p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-fg">Train Custom ML Model</h2>
          <p className="text-sm text-fg-subtle">
            Upload synthetic transaction data to retrain the risk prediction model on the fly.
          </p>
        </div>
        <Badge variant="outline">Experimental</Badge>
      </div>

      <div className="mb-4">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-fg">
          <Upload className="h-4 w-4" /> CSV Dataset
        </label>
        <textarea
          className="w-full rounded-lg border border-line bg-surface-2 p-3 text-sm text-fg font-mono placeholder:text-fg-subtle focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          rows={6}
          value={csvData}
          onChange={(e) => setCsvData(e.target.value)}
          placeholder="income,spending,debtToIncome,missedPayments,target\n..."
        />
      </div>

      <button
        onClick={handleTrain}
        disabled={isTraining || !csvData.trim()}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {isTraining ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
        {isTraining ? "Training Model..." : "Run Gradient Descent"}
      </button>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg bg-danger/10 p-3 text-sm text-danger">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-4 rounded-lg border border-line bg-surface-2 p-4">
          <div className="mb-3 flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            <span className="font-medium">Training Complete</span>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-fg-subtle">Dataset Size</p>
              <p className="font-medium text-fg">{result.datasetSize} samples</p>
            </div>
            <div>
              <p className="text-fg-subtle">Intercept</p>
              <p className="font-medium text-fg">{result.intercept.toFixed(4)}</p>
            </div>
          </div>
          <div className="mt-4">
            <p className="mb-2 text-sm text-fg-subtle">New Coefficients:</p>
            <pre className="rounded bg-surface p-2 text-xs text-fg overflow-x-auto">
              {JSON.stringify(result.coefficients, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
