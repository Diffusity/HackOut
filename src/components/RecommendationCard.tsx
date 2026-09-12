"use client";

import { useState } from "react";
import { Recommendation, TimingSignals } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { ChevronDown, Clock, EyeOff, ShieldOff } from "lucide-react";

const PRODUCT_LABELS: Record<string, string> = {
  RD: "Recurring Deposit",
  SIP: "Systematic Investment Plan",
  FD: "Fixed Deposit",
  CREDIT_CARD: "Credit Card",
  PERSONAL_LOAN: "Personal Loan",
  VEHICLE_LOAN: "Vehicle Loan",
  HOME_LOAN: "Home Loan",
  HEALTH_INSURANCE: "Health Insurance",
  EMI_RESTRUCTURE: "EMI Restructuring",
  NONE: "No recommendation",
};

export function RecommendationCard({
  recommendation,
  timing,
  narrationSource,
  loading,
}: {
  recommendation: Recommendation | null;
  timing?: TimingSignals | null;
  narrationSource?: "llm" | "deterministic";
  loading: boolean;
}) {
  const [traceOpen, setTraceOpen] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recommendation</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="h-6 w-2/3 animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-full animate-pulse rounded bg-surface-2" />
          <div className="h-3 w-5/6 animate-pulse rounded bg-surface-2" />
        </CardContent>
      </Card>
    );
  }

  if (!recommendation) return null;

  const suppressed = recommendation.wellnessGateStatus === "suppressed";
  const label = PRODUCT_LABELS[recommendation.product] ?? recommendation.product;
  const degraded = recommendation.reasonTrace.find((t) => t.startsWith("confidence_reduced"));
  const suppressedFrom = recommendation.reasonTrace
    .find((t) => t.startsWith("[WELLNESS GATE SUPPRESSION]"))
    ?.match(/Original product (\w+)/)?.[1];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle>{suppressed ? "Support offered" : "Recommendation"}</CardTitle>
          <div className="flex flex-wrap items-center justify-end gap-1.5">
            <Badge variant="muted">
              {Math.round(recommendation.confidence * 100)}% confidence
            </Badge>
            <Badge variant="muted">
              {narrationSource === "llm" ? "LLM narration" : "Template narration"}
            </Badge>
          </div>
        </div>
        <div className="text-2xl font-semibold tracking-tight">{label}</div>
      </CardHeader>

      <CardContent className="space-y-4">
        {suppressed && (
          <div className="flex gap-3 rounded-md border border-line-strong bg-surface-2 p-3">
            <ShieldOff className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold">Wellness gate held this sale back.</span>{" "}
              {suppressedFrom
                ? `${PRODUCT_LABELS[suppressedFrom] ?? suppressedFrom} was the natural offer for this profile. It was suppressed because the customer is under financial stress, and support was substituted.`
                : "An offer was suppressed because the customer is under financial stress."}
            </div>
          </div>
        )}

        {degraded && (
          <div className="flex gap-3 rounded-md border border-dashed border-line-strong bg-surface-2 p-3">
            <EyeOff className="mt-0.5 h-4 w-4 shrink-0" />
            <div className="text-xs leading-relaxed">
              <span className="font-semibold">We are working with an incomplete picture.</span>{" "}
              {degraded.replace(/^confidence_reduced \(|\)$/g, "")}. Withholding data does not only
              cost personalisation — without spend categories we cannot see a missed EMI, so the
              wellness gate cannot protect this customer either.
            </div>
          </div>
        )}

        {timing?.trigger && (
          <div className="flex items-start gap-2 text-xs text-fg-muted">
            <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              <span className="font-medium text-fg">
                {timing.trigger.replace(/_/g, " ")} ({timing.urgency})
              </span>{" "}
              — {timing.reason}
            </span>
          </div>
        )}

        <p className="text-sm leading-relaxed">{recommendation.plainLanguageExplanation}</p>

        <div className="border-t border-line pt-3">
          <button
            type="button"
            onClick={() => setTraceOpen(!traceOpen)}
            className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted hover:text-fg"
          >
            <span>Reason trace ({recommendation.reasonTrace.length})</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${traceOpen ? "rotate-180" : ""}`} />
          </button>

          {traceOpen && (
            <ol className="animate-fade-up mt-3 space-y-2">
              {recommendation.reasonTrace.map((trace, i) => (
                <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
                  <span className="tnum shrink-0 font-mono text-fg-subtle">{i + 1}</span>
                  <span className="break-words">{trace}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
