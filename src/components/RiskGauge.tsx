import { useState } from "react";
import { RiskFactor, RiskPrediction } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { BrainCircuit, FlaskConical, Search } from "lucide-react";
import { RiskExplainabilityModal } from "./RiskExplainabilityModal";

type RiskResponse = RiskPrediction & { toolName?: string; reasonTrace?: string[] };

export function RiskGauge({ data }: { data: RiskResponse | null }) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  if (!data) return null;

  const pct = Math.round(data.probability * 100);
  const bandColor =
    data.riskBand === "high"
      ? "text-rose-400"
      : data.riskBand === "medium"
        ? "text-amber-400"
        : "text-emerald-400";
  const barColor =
    data.riskBand === "high"
      ? "bg-rose-500"
      : data.riskBand === "medium"
        ? "bg-amber-500"
        : "bg-emerald-500";

  // Contribution bars: positive pushes risk UP (left), negative pulls DOWN (right)
  const maxAbs = Math.max(
    1,
    ...data.topFactors.map((f) => Math.abs(f.contribution))
  );

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BrainCircuit className={`w-5 h-5 ${bandColor}`} />
              <span className="flex items-center gap-2">
                ML Risk Prediction
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-400 bg-gray-800 border border-white/10 rounded-full px-2 py-0.5">
                  <FlaskConical className="w-3 h-3" /> experimental
                </span>
              </span>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors"
              title="Explain Risk Model"
            >
              <Search className="w-4 h-4" />
            </button>
          </CardTitle>
        </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-center">
          <div className={`text-4xl font-bold ${bandColor}`}>{pct}%</div>
          <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">
            next-month EMI miss probability
          </div>
        </div>

        <div className="w-full h-2 bg-gray-800 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all duration-700 ease-out`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>

        <div className="text-xs text-gray-400 text-center">
          Risk band: <span className={`font-semibold ${bandColor}`}>{data.riskBand}</span>
          {" · "}model {data.modelVersion}
        </div>

        <div className="space-y-2 pt-1 border-t border-white/5">
          {data.topFactors.map((f: RiskFactor) => {
            const pushRight = f.contribution < 0;
            const w = (Math.abs(f.contribution) / maxAbs) * 100;
            return (
              <div key={f.feature} className="text-xs">
                <div className="flex justify-between text-gray-300 mb-0.5">
                  <span className="capitalize">{f.feature}</span>
                  <span className={f.contribution >= 0 ? "text-rose-400" : "text-emerald-400"}>
                    {f.contribution >= 0 ? "+" : ""}
                    {f.contribution.toFixed(2)}
                  </span>
                </div>
                <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
                  <div
                    className={`absolute top-0 h-full rounded-full ${f.contribution >= 0 ? "bg-rose-500/70 left-0" : "bg-emerald-500/70 right-0"}`}
                    style={pushRight ? { width: `${w}%`, right: "50%" } : { width: `${w}%`, left: "50%" }}
                  />
                </div>
              </div>
            );
          })}
          <p className="text-[10px] text-gray-500 pt-1">
            {data.topFactors[0]?.feature} is the top driver of this score. Advisory-only — the
            deterministic rule engine always makes the final call.
          </p>
        </div>
      </CardContent>
    </Card>
    <RiskExplainabilityModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  );
}