import { Customer } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface SegmentInfo {
  name: string;
  savingsPercentile: number;
  share: number;
}

export function ProfileCard({
  customer,
  segment,
}: {
  customer: Customer | null;
  segment?: SegmentInfo | null;
}) {
  if (!customer) return null;

  const rows = [
    { label: "Work", value: customer.segment.replace("_", " ") },
    { label: "Location", value: `Tier ${customer.cityTier} town` },
    { label: "Language", value: customer.preferredLanguage.toUpperCase() },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Customer</CardTitle>
        <div className="text-lg font-semibold tracking-tight">{customer.name}</div>
      </CardHeader>
      <CardContent className="space-y-3">
        <dl className="space-y-2 text-sm">
          {rows.map((row) => (
            <div key={row.label} className="flex items-baseline justify-between gap-3">
              <dt className="text-fg-subtle">{row.label}</dt>
              <dd className="capitalize text-fg">{row.value}</dd>
            </div>
          ))}
        </dl>

        {segment && (
          <div className="border-t border-line pt-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">
                Behavioural segment
              </span>
              <Badge variant="muted">k-means</Badge>
            </div>
            <div className="text-sm font-medium">{segment.name}</div>
            <p className="mt-1 text-xs leading-relaxed text-fg-muted">
              Saves more than{" "}
              <span className="tnum font-semibold text-fg">{segment.savingsPercentile}%</span> of
              comparable customers. This segment covers{" "}
              <span className="tnum">{Math.round(segment.share * 100)}%</span> of the modelled
              population.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
