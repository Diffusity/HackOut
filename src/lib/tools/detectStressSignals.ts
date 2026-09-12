import { StressAlert, Signals, ToolResult, ModelVerdict } from "../types";
import { getCustomerSignals } from "./getCustomerSignals";
import { createChatModel, sendWithRetry } from "../gemini";
import { predictDistress } from "../ml/model";

/**
 * Pure, deterministic stress scoring — no LLM involved (ADR-011 / ADR-015).
 * The LLM is only used downstream to phrase the intervention empathetically.
 */
export function computeStressCore(signals: Signals): {
  wellnessScore: number;
  isAtRisk: boolean;
  reasons: string[];
  recommendedIntervention: string;
  model: ModelVerdict;
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

  let isAtRisk = score <= 50;

  // ---- ML layer (ADR-027): the model proposes, the rules dispose ----
  // The trained model runs alongside the rules and may ESCALATE a customer
  // into protection. It is never allowed to clear a customer the rules have
  // flagged, so a model error can only ever cost us a sale, never expose a
  // vulnerable customer to one.
  const prediction = predictDistress(signals);
  const rulesAtRisk = isAtRisk;
  let escalatedByModel = false;

  if (!rulesAtRisk && prediction.escalates) {
    isAtRisk = true;
    escalatedByModel = true;
    const top = prediction.contributions.filter((c) => c.contribution > 0).slice(0, 2);
    reasonTrace.push(
      `Model flagged elevated distress risk (${Math.round(prediction.probability * 100)}%, ` +
        `threshold ${Math.round(prediction.threshold * 100)}%) driven by ${top.map((c) => c.label).join(" and ")}`
    );
  }

  const model = {
    probability: prediction.probability,
    escalates: prediction.escalates,
    threshold: prediction.threshold,
    modelVersion: prediction.modelVersion,
    contributions: prediction.contributions,
    agreesWithRules: prediction.escalates === rulesAtRisk,
    escalatedByModel,
  };

  let recommendedIntervention = "none";
  if (score < 30) {
    recommendedIntervention = "counselor_connect";
  } else if (score < 50) {
    recommendedIntervention = "restructuring_offer";
  } else if (score < 70) {
    recommendedIntervention = "empathetic_checkin";
  }

  return { wellnessScore: score, isAtRisk, reasons: reasonTrace, recommendedIntervention, model };
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
      model: core.model,
    },
    reasonTrace,
    confidence: 1.0,
    timestamp: new Date(),
  };
}
