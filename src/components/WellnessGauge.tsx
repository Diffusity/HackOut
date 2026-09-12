import { StressAlert } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

function statusFor(score: number) {
  if (score < 50) return "At risk";
  if (score < 70) return "Watch";
  return "Healthy";
}

export function WellnessGauge({ data }: { data: StressAlert | null }) {
  if (!data) return null;

  const score = data.wellnessScore;
  const status = statusFor(score);
  const model = data.model;

  // Semicircle arc: 0 -> 100 maps onto a half turn.
  const radius = 56;
  const circumference = Math.PI * radius;
  const filled = (score / 100) * circumference;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Financial wellness</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center">
          <svg viewBox="0 0 140 78" className="w-full max-w-[200px]" role="img" aria-label={`Wellness score ${score} of 100`}>
            <path
              d="M 14 70 A 56 56 0 0 1 126 70"
              fill="none"
              stroke="var(--surface-3)"
              strokeWidth="10"
              strokeLinecap="round"
            />
            <path
              d="M 14 70 A 56 56 0 0 1 126 70"
              fill="none"
              stroke="var(--fg)"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${circumference}`}
              className="transition-[stroke-dasharray] duration-700 ease-out"
            />
            <text
              x="70"
              y="62"
              textAnchor="middle"
              className="tnum"
              style={{ fill: "var(--fg)", fontSize: "28px", fontWeight: 600 }}
            >
              {score}
            </text>
          </svg>

          <div className="mt-1 flex items-center gap-2">
            <Badge variant={status === "Healthy" ? "outline" : "solid"}>{status}</Badge>
            <span className="text-xs text-fg-subtle">rules score</span>
          </div>
        </div>

        {model && (
          <div className="mt-4 border-t border-line pt-3">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-fg-muted">Model distress risk</span>
              <span className="tnum font-semibold">{Math.round(model.probability * 100)}%</span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-3">
              <div
                className="h-1 rounded-full bg-accent"
                style={{ width: `${Math.min(100, model.probability * 100)}%` }}
              />
            </div>
            <p className="mt-2 text-xs leading-relaxed text-fg-muted">
              {model.escalatedByModel
                ? "The rules cleared this customer. The model did not, so we took the safer answer and held offers back."
                : model.escalates
                  ? "Model and rules agree this customer needs support rather than an offer."
                  : `Below the ${Math.round(model.threshold * 100)}% intervention threshold.`}
            </p>
          </div>
        )}

        {data.reasons.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-line pt-3 text-xs text-fg-muted">
            {data.reasons.map((reason, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-fg-subtle">—</span>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        )}

        {data.empatheticMessage && (
          <p className="mt-3 rounded-md bg-surface-2 p-3 text-xs leading-relaxed text-fg">
            {data.empatheticMessage}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
