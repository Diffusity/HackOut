"use client";

import { Badge } from "./ui/badge";
import { RotateCcw } from "lucide-react";

/**
 * The demo clock (ADR-023).
 *
 * Every timing rule already accepts an injectable `now`, so moving this slider
 * moves the whole deterministic pipeline: rolling windows, EMI due dates,
 * festival proximity, the wellness gate. It exists so a claim about contextual
 * timing can be tested by the person hearing it instead of taken on trust.
 */
export function TimeMachine({
  offsetDays,
  onChange,
  baseDate,
}: {
  offsetDays: number;
  onChange: (days: number) => void;
  baseDate: Date;
}) {
  const target = new Date(baseDate.getTime() + offsetDays * 86400000);
  const formatted = target.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border border-line bg-surface px-5 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">
              Time machine
            </span>
            <Badge variant={offsetDays === 0 ? "muted" : "solid"}>
              {offsetDays === 0 ? "Today" : `${offsetDays > 0 ? "+" : ""}${offsetDays} days`}
            </Badge>
          </div>
          <div className="tnum mt-1 text-sm font-medium">{formatted}</div>
        </div>

        {offsetDays !== 0 && (
          <button
            type="button"
            onClick={() => onChange(0)}
            className="inline-flex items-center gap-1.5 rounded border border-line px-2 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
          >
            <RotateCcw className="h-3 w-3" /> Reset to today
          </button>
        )}
      </div>

      <input
        type="range"
        min={-90}
        max={180}
        step={1}
        value={offsetDays}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label="Move the demo clock"
        className="mt-4 w-full"
      />

      <div className="mt-1.5 flex justify-between text-[10px] text-fg-subtle">
        <span>90 days back</span>
        <span>now</span>
        <span>180 days forward</span>
      </div>

      <p className="mt-2 text-xs leading-relaxed text-fg-muted">
        Move the clock and the recommendation, timing trigger and wellness gate all recompute from
        the same transaction history.
      </p>
    </div>
  );
}
