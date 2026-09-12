import { StressAlert, Recommendation } from "../types";

/**
 * Products that represent a sales push (credit, investment, insurance).
 * When a customer is flagged At Risk, the Wellness Gate pauses ALL of these —
 * not just credit — and substitutes support (EMI_RESTRUCTURE), so the gate is
 * the single, visible decision point between tool output and response
 * (ADR-012, amended: investment/insurance pushes are paused too).
 */
const SALES_PRODUCTS = [
  "PERSONAL_LOAN",
  "CREDIT_CARD",
  "HOME_LOAN",
  "VEHICLE_LOAN",
  "SIP",
  "RD",
  "FD",
  "HEALTH_INSURANCE",
];

export function applyWellnessGate(
  stressAlert: StressAlert,
  recommendation: Recommendation
): Recommendation {
  if (
    SALES_PRODUCTS.includes(recommendation.product) &&
    stressAlert.isAtRisk
  ) {
    return {
      ...recommendation,
      product: "EMI_RESTRUCTURE", // Substitute product
      wellnessGateStatus: "suppressed",
      reasonTrace: [
        ...recommendation.reasonTrace,
        `[WELLNESS GATE SUPPRESSION] Original product ${recommendation.product} suppressed because customer is flagged as At Risk (Score: ${stressAlert.wellnessScore}). Pausing the sales push and offering support/restructuring instead.`
      ]
    };
  }
  
  return recommendation;
}
