import Link from "next/link";
import { ModelVerdict } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

/**
 * Shows the model's per-feature contributions. Because the model is additive
 * (logistic regression), these are the exact contributions to the log-odds,
 * not an approximation of a black box, which is what makes them safe to show a
 * customer as the reasons behind a decision.
 */
export function ModelPanel({ model }: { model: ModelVerdict | null | undefined }) {
  if (!model) return null;

  const maxMagnitude = Math.max(...model.contributions.map((c) => Math.abs(c.contribution)), 0.001);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Model contributions</CardTitle>
          <Badge variant="muted">v{model.modelVersion}</Badge>
        </div>
        <p className="text-xs leading-relaxed text-fg-muted">
          Monotonic logistic regression. Each bar is that factor&rsquo;s exact contribution to the
          risk score: left of centre lowers risk, right raises it.
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {model.contributions.map((c) => {
          const width = (Math.abs(c.contribution) / maxMagnitude) * 50;
          const raises = c.contribution >= 0;
          return (
            <div key={c.feature}>
              <div className="mb-1 flex items-baseline justify-between text-xs">
                <span className="text-fg-muted">{c.label}</span>
                <span className="tnum font-medium">
                  {raises ? "+" : ""}
                  {c.contribution.toFixed(2)}
                </span>
              </div>
              <div className="relative h-1.5 w-full rounded-full bg-surface-2">
                <div className="absolute left-1/2 top-0 h-1.5 w-px bg-line-strong" />
                <div
                  className={`absolute top-0 h-1.5 ${raises ? "rounded-r-full bg-accent" : "rounded-l-full bg-fg-subtle"}`}
                  style={raises ? { left: "50%", width: `${width}%` } : { right: "50%", width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}

        <div className="space-y-2 border-t border-line pt-3 text-xs">
          <div className="flex items-baseline justify-between">
            <span className="text-fg-muted">Predicted distress risk</span>
            <span className="tnum font-semibold">{Math.round(model.probability * 100)}%</span>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-fg-muted">Intervention threshold</span>
            <span className="tnum">{Math.round(model.threshold * 100)}%</span>
          </div>
          <p className="leading-relaxed text-fg-muted">
            The model can pull a customer into protection. It can never release one the rules have
            flagged, so a model error costs a sale rather than a customer.
          </p>
          <Link href="/model-card" className="inline-block underline underline-offset-4 hover:text-fg">
            Read the model card
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
