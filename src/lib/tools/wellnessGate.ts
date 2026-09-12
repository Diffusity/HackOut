import { StressAlert, Recommendation } from "../types";

const CREDIT_PRODUCTS = ["PERSONAL_LOAN", "CREDIT_CARD", "HOME_LOAN", "VEHICLE_LOAN"];

export function applyWellnessGate(
  stressAlert: StressAlert,
  recommendation: Recommendation
): Recommendation {
  if (CREDIT_PRODUCTS.includes(recommendation.product) && stressAlert.isAtRisk) {
    return {
      ...recommendation,
      product: "EMI_RESTRUCTURE", // Substitute product
      wellnessGateStatus: "suppressed",
      reasonTrace: [
        ...recommendation.reasonTrace,
        `[WELLNESS GATE SUPPRESSION] Original product ${recommendation.product} suppressed because customer is flagged as At Risk (Score: ${stressAlert.wellnessScore}). Suggesting support/restructuring instead.`
      ]
    };
  }
  
  return recommendation;
}
