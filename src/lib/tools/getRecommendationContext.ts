import { checkConsent } from "./checkConsent";
import { getCustomerSignals } from "./getCustomerSignals";
import { recommendProduct } from "./recommendProduct";
import { computeStressCore } from "./detectStressSignals";
import { applyWellnessGate } from "./wellnessGate";
import { Recommendation, Signals } from "../types";

export interface RecommendationContext {
  consentGranted: boolean;
  allowedCategories: string[];
  signals: Signals | null;
  recommendation: Recommendation | null;
  wellnessScore: number | null;
  isAtRisk: boolean;
  stressReasons: string[];
  gateStatus: "passed" | "suppressed" | null;
  /** Full deterministic reason trace — the ONLY facts the LLM may narrate from */
  reasonTrace: string[];
}

/**
 * Builds the complete deterministic decision context for a customer — with
 * ZERO LLM calls (pure TypeScript, per ADR-011). This is the grounding data
 * injected into chat so the LLM can *reason about* and *explain* a
 * recommendation without ever inventing a financial fact (ADR-021).
 */
export function getRecommendationContext(customerId: string): RecommendationContext {
  // 1. Consent is always the first gate (ADR-014)
  const consentResult = checkConsent(customerId);
  const consent = consentResult.output;

  if (!consent.consentGranted) {
    return {
      consentGranted: false,
      allowedCategories: [],
      signals: null,
      recommendation: null,
      wellnessScore: null,
      isAtRisk: false,
      stressReasons: [],
      gateStatus: null,
      reasonTrace: consentResult.reasonTrace,
    };
  }

  // 2. Deterministic signals → recommendation → stress → wellness gate
  const signalsResult = getCustomerSignals(customerId);
  const signals = signalsResult.output;
  const baseRec = recommendProduct(signals);
  const stress = computeStressCore(signals);
  const gatedRec = applyWellnessGate(
    {
      customerId,
      isAtRisk: stress.isAtRisk,
      wellnessScore: stress.wellnessScore,
      reasons: stress.reasons,
      recommendedIntervention: stress.recommendedIntervention,
      empatheticMessage: "",
    },
    baseRec.output
  );

  return {
    consentGranted: true,
    allowedCategories: consent.allowedCategories,
    signals,
    recommendation: gatedRec,
    wellnessScore: stress.wellnessScore,
    isAtRisk: stress.isAtRisk,
    stressReasons: stress.reasons,
    gateStatus: gatedRec.wellnessGateStatus,
    reasonTrace: [...consentResult.reasonTrace, ...signalsResult.reasonTrace, ...gatedRec.reasonTrace],
  };
}
