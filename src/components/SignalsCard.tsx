import { Signals } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

function Meter({ label, value, display }: { label: string; value: number; display: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between text-xs">
        <span className="text-fg-muted">{label}</span>
        <span className="tnum font-medium text-fg">{display}</span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-surface-3">
        <div
          className="h-1 rounded-full bg-accent transition-[width] duration-500"
          style={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        />
      </div>
    </div>
  );
}

export function SignalsCard({ signals }: { signals: Signals | null }) {
  if (!signals) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Extracted signals</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Meter
          label="Salary regularity"
          value={signals.salaryRegularityScore}
          display={`${(signals.salaryRegularityScore * 100).toFixed(0)}%`}
        />
        <Meter
          label="Savings rate"
          value={signals.savingsRate}
          display={`${(signals.savingsRate * 100).toFixed(1)}%`}
        />
        <Meter
          label="Spend volatility (30d)"
          value={Math.min(1, signals.spendVolatility30d)}
          display={`${(signals.spendVolatility30d * 100).toFixed(0)}%`}
        />

        <div className="flex items-baseline justify-between border-t border-line pt-3 text-sm">
          <span className="text-fg-muted">Missed EMIs (90 days)</span>
          <span className="tnum font-semibold">{signals.emiMissCount90d}</span>
        </div>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-xs text-fg-subtle">Monthly in</div>
            <div className="tnum font-medium">₹{signals.monthlyIncome.toLocaleString("en-IN")}</div>
          </div>
          <div>
            <div className="text-xs text-fg-subtle">Monthly out</div>
            <div className="tnum font-medium">₹{signals.monthlyExpense.toLocaleString("en-IN")}</div>
          </div>
        </div>

        <div className="border-t border-line pt-3">
          <div className="mb-2 text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
            Life-stage tags
          </div>
          <div className="flex flex-wrap gap-1.5">
            {signals.lifeStageTags.map((tag) => (
              <Badge key={tag} variant="muted">
                {tag.replace(/_/g, " ")}
              </Badge>
            ))}
            {signals.lifeStageTags.length === 0 && (
              <span className="text-xs text-fg-subtle">None detected</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
