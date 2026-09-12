import { Recommendation, TimingSignals, ModelVerdict } from "./types";
import { productName } from "./narration";

/**
 * Next best action (ADR-029).
 *
 * A dashboard shows everything at once; a customer needs to know the one thing
 * that matters now. This is a strict priority resolver over engines we already
 * run — deterministic, so the banner can never disagree with the cards beneath
 * it, and ordered so that protection always outranks selling.
 */

export type ActionSource = "fraud" | "wellness" | "model" | "timing" | "recommendation";

export interface NextBestAction {
  source: ActionSource;
  title: string;
  detail: string;
  ctaLabel: string;
  /** True when this action is support rather than a sale */
  protective: boolean;
}

export function resolveNextBestAction(input: {
  recommendation: Recommendation;
  timing?: TimingSignals | null;
  model?: ModelVerdict | null;
  wellnessScore?: number | null;
  anomalies?: { overallRiskScore: number; anomalies: any[] } | null;
}): NextBestAction {
  const { recommendation, timing, model, wellnessScore, anomalies } = input;

  // 0. Fraud / Security is the absolute highest priority
  if (anomalies && anomalies.overallRiskScore >= 70) {
    const topAnomaly = anomalies.anomalies[0];
    return {
      source: "fraud",
      title: "Security Hold: Unusual Activity Detected",
      detail: `We detected unusual activity on your account (${topAnomaly?.description || "High risk pattern"}). Your account features have been temporarily restricted to protect your funds.`,
      ctaLabel: "Verify Activity",
      protective: true,
    };
  }

  // 1. If the model is the reason the gate closed, say that — otherwise the
  // banner would quote a healthy rules score while withholding an offer, which
  // reads as a contradiction rather than an early warning.
  if (model?.escalatedByModel) {
    const driver = model.contributions.find((c) => c.contribution > 0);
    return {
      source: "model",
      title: "Early warning, before anything goes wrong",
      detail:
        `Nothing has gone wrong yet — no EMI has been missed. But this account matches the pattern of customers who ran into trouble within 90 days` +
        `${driver ? `, driven mainly by ${driver.label}` : ""}, so we have paused offers and would rather check in than sell.`,
      ctaLabel: "Talk to us",
      protective: true,
    };
  }

  // 2. The wellness rules held a sale back.
  if (recommendation.wellnessGateStatus === "suppressed") {
    return {
      source: "wellness",
      title: "We are not selling you anything today",
      detail:
        `Your recent transactions show financial pressure${typeof wellnessScore === "number" ? ` (wellness ${wellnessScore}/100)` : ""}, ` +
        `so the offer you would normally see has been paused. ${productName(recommendation.product)} is available instead, with no penalty.`,
      ctaLabel: "See support options",
      protective: true,
    };
  }

  // 3. A time-sensitive moment worth acting on now.
  if (timing?.trigger && timing.urgency === "now") {
    return {
      source: "timing",
      title: `Good moment: ${timing.trigger.replace(/_/g, " ")}`,
      detail: `${timing.reason} ${productName(recommendation.product)} fits this moment.`,
      ctaLabel: `Explore ${productName(recommendation.product)}`,
      protective: false,
    };
  }

  // 4. Otherwise, the recommendation itself — with an invitation to interrogate it.
  return {
    source: "recommendation",
    title: `${productName(recommendation.product)} suits this profile`,
    detail:
      recommendation.plainLanguageExplanation ||
      `Based on the transaction history, ${productName(recommendation.product)} is the closest match.`,
    ctaLabel: "Ask why",
    protective: false,
  };
}
