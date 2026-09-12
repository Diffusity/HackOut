import { Recommendation, Signals, ToolResult } from "../types";

export function recommendProduct(
  signals: Signals
): ToolResult<Recommendation> {
  const reasonTrace: string[] = [];
  let product = "PERSONAL_LOAN";
  let confidence = 0.5;

  const {
    savingsRate,
    monthlyIncome,
    lifeStageTags,
    incomeType,
    salaryRegularityScore,
    spendVolatility30d,
  } = signals;

  if (lifeStageTags.includes("financially_stressed")) {
    product = "EMI_RESTRUCTURE";
    confidence = 0.95;
    reasonTrace.push(`product=${product} (Customer flagged as financially stressed; prioritizing support over credit)`);
  } else if (incomeType === "gig" && salaryRegularityScore === 0) {
    product = "VEHICLE_LOAN";
    confidence = 0.85;
    reasonTrace.push(`product=${product} (Gig economy worker with variable income pattern; flexible vehicle financing is high-relevance)`);
  } else if (savingsRate > 0.4 && monthlyIncome > 30000) {
    product = "SIP";
    confidence = 0.9;
    reasonTrace.push(`product=${product} (High savings rate of ${(savingsRate * 100).toFixed(1)}% with sufficient income for wealth generation)`);
  } else if (savingsRate > 0.2) {
    product = "RD";
    confidence = 0.8;
    reasonTrace.push(`product=${product} (Consistent savings behavior detected; RD encourages disciplined saving)`);
  } else if (lifeStageTags.includes("recent_salary_hike")) {
    product = "FD";
    confidence = 0.85;
    reasonTrace.push(`product=${product} (Recent salary hike detected; suggesting FD for lump sum saving)`);
  } else if (lifeStageTags.includes("family_expenses")) {
    product = "HEALTH_INSURANCE";
    confidence = 0.8;
    reasonTrace.push(`product=${product} (Family-related expenses detected; health insurance protects dependents)`);
  } else if (monthlyIncome > 80000 && lifeStageTags.includes("stable_income")) {
    product = "HOME_LOAN";
    confidence = 0.75;
    reasonTrace.push(`product=${product} (High stable income qualifies for long-term secure credit)`);
  } else if (monthlyIncome > 50000 && savingsRate > 0.3) {
    product = "CREDIT_CARD";
    confidence = 0.7;
    reasonTrace.push(`product=${product} (Good income and savings behavior qualifies for premium credit card)`);
  } else {
    product = "PERSONAL_LOAN";
    confidence = 0.6;
    reasonTrace.push(`product=${product} (Default recommendation based on moderate income and spend profile)`);
  }

  return {
    toolName: "recommendProduct",
    output: {
      customerId: signals.customerId,
      product,
      confidence,
      reasonTrace,
      plainLanguageExplanation: "", // This will be filled by the LLM
      wellnessGateStatus: "passed", // Default, might be overridden by Wellness Gate wrapper later
    },
    reasonTrace,
    confidence,
    timestamp: new Date(),
  };
}
