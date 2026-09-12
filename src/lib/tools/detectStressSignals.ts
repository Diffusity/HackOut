import { StressAlert, ToolResult } from "../types";
import { getCustomerSignals } from "./getCustomerSignals";
import { geminiPro } from "../gemini";

export async function detectStressSignals(customerId: string): Promise<ToolResult<StressAlert>> {
  const signalsResult = getCustomerSignals(customerId);
  const signals = signalsResult.output;
  
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

  // Generate empathetic message via LLM
  let empatheticMessage = "";
  if (isAtRisk || score < 70) {
    if (process.env.GEMINI_API_KEY) {
      try {
        const systemPrompt = `
          You are DhanSathi, phrasing financial interventions in empathetic, non-judgmental language.
          Frame interventions as support, not punishment.
          The user has a wellness score of ${score}/100.
          Reasons for concern: ${reasonTrace.join(", ")}.
          Recommended action: ${recommendedIntervention}.
          Write a 1-2 sentence supportive message to the user acknowledging things might be tight and offering help.
        `;
        const chat = geminiPro.startChat({
          generationConfig: { temperature: 0.3 }
        });
        const res = await chat.sendMessage(systemPrompt);
        empatheticMessage = res.response.text();
      } catch (e) {
        console.error("Failed to generate empathetic message:", e);
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
