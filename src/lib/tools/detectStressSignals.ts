import { StressAlert, Signals, ToolResult } from "../types";
import { getCustomerSignals } from "./getCustomerSignals";
import { createChatModel, sendWithRetry } from "../gemini";

/**
 * Pure, deterministic stress scoring — no LLM involved (ADR-011 / ADR-015).
 * The LLM is only used downstream to phrase the intervention empathetically.
 */
export function computeStressCore(signals: Signals): {
  wellnessScore: number;
  isAtRisk: boolean;
  reasons: string[];
  recommendedIntervention: string;
} {
  const reasonTrace: string[] = [];
  let score = 100;

  if (signals.emiMissCount90d >= 2) {
    score -= 30;
    reasonTrace.push(`${signals.emiMissCount90d} EMIs missed in last 90 days`);
  } else if (signals.emiMissCount90d === 1) {
    score -= 15;
    reasonTrace.push(`1 EMI missed in last 90 days`);
  }

  if (signals.spendVolatility30d > 0.5) {
    score -= 15;
    reasonTrace.push(`Unusual spending variability detected (score: ${signals.spendVolatility30d.toFixed(2)})`);
  }

  if (signals.savingsRate < 0.05) {
    score -= 20;
    reasonTrace.push(`Savings rate below 5% safety threshold`);
  }

  if (signals.lifeStageTags.includes("financially_stressed")) {
    score -= 20;
    reasonTrace.push(`Financial stress indicators detected in spending patterns`);
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  const isAtRisk = score <= 50;

  let recommendedIntervention = "none";
  if (score < 30) {
    recommendedIntervention = "counselor_connect";
  } else if (score < 50) {
    recommendedIntervention = "restructuring_offer";
  } else if (score < 70) {
    recommendedIntervention = "empathetic_checkin";
  }

  return { wellnessScore: score, isAtRisk, reasons: reasonTrace, recommendedIntervention };
}

export async function detectStressSignals(customerId: string, now?: Date): Promise<ToolResult<StressAlert>> {
  const signalsResult = getCustomerSignals(customerId, now);
  const signals = signalsResult.output;

  const core = computeStressCore(signals);
  const reasonTrace = core.reasons;
  const { wellnessScore: score, isAtRisk, recommendedIntervention } = core;

  // Generate empathetic message via LLM
  let empatheticMessage = "";
  if (isAtRisk || score < 70) {
    if (process.env.GEMINI_API_KEY) {
      try {
        const chat = createChatModel({
          systemInstruction: "You are DhanSathi, phrasing financial interventions in empathetic, non-judgmental language. Frame interventions as support, not punishment. Write a 1-2 sentence supportive message to the user acknowledging things might be tight and offering help.",
          generationConfig: { temperature: 0.3 }
        });
        const res = await sendWithRetry(chat,
          `The user has a wellness score of ${score}/100.\n` +
          `Reasons for concern: ${reasonTrace.join(", ")}.\n` +
          `Recommended action: ${recommendedIntervention}.\n` +
          `Write a 1-2 sentence supportive message to the user.`
        );
        empatheticMessage = res.response.text();
      } catch (e) {
        console.log("Failed to generate empathetic message — using deterministic fallback:", (e as any)?.message ?? e);
        empatheticMessage = "We noticed things have been tight lately. Would you like to explore ways to reduce your monthly burden?";
      }
    } else {
      empatheticMessage = "We noticed things have been tight lately. Would you like to explore ways to reduce your monthly burden?";
    }
  } else {
    empatheticMessage = "Your financial health looks stable.";
  }

  return {
    toolName: "detectStressSignals",
    output: {
      customerId,
      isAtRisk,
      wellnessScore: score,
      reasons: reasonTrace,
      recommendedIntervention,
      empatheticMessage,
    },
    reasonTrace,
    confidence: 1.0,
    timestamp: new Date(),
  };
}
