import { ShieldAlert } from "lucide-react";
import { Badge } from "./ui/badge";
import { AnomalyReport } from "@/lib/types";

interface Props {
  data: AnomalyReport | null;
}

export function AnomalyCard({ data }: Props) {
  if (!data) return null;

  return (
    <div className="rounded-xl border border-line bg-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-rose-500" />
          <h3 className="text-sm font-semibold tracking-tight text-fg">Fraud & Anomalies</h3>
        </div>
        <span className="text-[10px] uppercase tracking-wider text-fg-subtle">
          Risk Score: {data.overallRiskScore}
        </span>
      </div>

      {data.anomalies.length === 0 ? (
        <div className="text-xs text-fg-muted">
          No unusual activity detected.
        </div>
      ) : (
        <div className="space-y-3">
          {data.anomalies.map((a, i) => (
            <div key={i} className="flex flex-col gap-1 rounded-md bg-surface-2 p-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-fg">{a.type}</span>
                <Badge variant={a.severity === "high" ? "solid" : "outline"} className={a.severity === "high" ? "bg-rose-500 text-white" : ""}>
                  {a.severity}
                </Badge>
              </div>
              <span className="text-xs text-fg-muted">{a.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
