import { X, Network, BookOpen, AlertCircle } from "lucide-react";
import { Badge } from "./ui/badge";

interface RiskExplainabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RiskExplainabilityModal({ isOpen, onClose }: RiskExplainabilityModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl animate-fade-up rounded-xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-3">
            <Network className="h-5 w-5 text-accent" />
            <h2 className="text-lg font-semibold text-fg">Risk Model Explainability</h2>
            <Badge variant="outline">ADR-022</Badge>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[70vh]">
          <div className="mb-6 rounded-lg bg-surface-2 p-4 text-sm text-fg">
            <p className="mb-2">
              Our risk prediction relies on a logistic regression model. This view exposes the global feature weights (coefficients). Positive weights increase the estimated risk of a missed payment, while negative weights decrease it.
            </p>
            <div className="flex items-start gap-2 mt-3 rounded border border-accent/20 bg-accent/10 p-2 text-accent">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs">
                This model is strictly advisory. The deterministic rule engine always makes the final credit decision.
              </p>
            </div>
          </div>

          <h3 className="mb-3 text-sm font-semibold text-fg">Global Feature Importance</h3>
          <div className="space-y-3">
            {/* Hardcoded visualization of original model weights for demo purposes */}
            {[
              { name: "emiToIncomeRatio", weight: 0.685, desc: "EMI burden as a share of income" },
              { name: "logTxnCount", weight: 0.664, desc: "transaction activity level" },
              { name: "incomeVolatility", weight: 0.865, desc: "income stream stability" },
              { name: "categoryConcentration", weight: -0.236, desc: "how concentrated spending is" },
              { name: "spendVolatility", weight: -0.468, desc: "week-to-week spending swings" },
              { name: "salaryRegularity", weight: -0.610, desc: "salary arrived as expected" },
              { name: "momDebitTrend", weight: -1.109, desc: "spend change vs the previous month" },
              { name: "savingsRate", weight: -2.194, desc: "share of income saved this month" },
            ].sort((a, b) => b.weight - a.weight).map((f) => (
              <div key={f.name} className="flex items-center gap-4 text-sm">
                <div className="w-1/3 truncate text-fg" title={f.desc}>
                  {f.name}
                  <p className="text-[10px] text-fg-subtle truncate">{f.desc}</p>
                </div>
                <div className="flex-1">
                  <div className="relative h-2 rounded-full bg-surface-2">
                    <div
                      className={`absolute top-0 h-full rounded-full ${
                        f.weight > 0 ? "bg-rose-500/80 right-[50%]" : "bg-emerald-500/80 left-[50%]"
                      }`}
                      style={{
                        width: `${Math.abs(f.weight) * 20}%`, // Scaled for UI
                      }}
                    />
                  </div>
                </div>
                <div className={`w-12 text-right text-xs font-mono ${f.weight > 0 ? "text-rose-400" : "text-emerald-400"}`}>
                  {f.weight > 0 ? "+" : ""}{f.weight.toFixed(2)}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex items-center justify-between border-t border-line pt-4 text-xs text-fg-subtle">
            <div className="flex items-center gap-1.5">
              <BookOpen className="h-3 w-3" /> Base model bias: -5.29
            </div>
            <div>Model Version: risknet-1.0</div>
          </div>
        </div>
      </div>
    </div>
  );
}
