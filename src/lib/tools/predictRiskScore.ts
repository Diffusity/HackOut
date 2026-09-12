/**
 * RiskNet inference tool (F26, ADR-022) — `predictRiskScore`.
 *
 * Advisory-only ML risk prediction. The deterministic rule engine is ALWAYS
 * the final decision maker; this tool only adds an explainable signal.
 *
 * - Loads the committed artifact (src/data/risk-model.json) via static import
 *   — inference is a pure dot product, no training, no fs reads at request time.
 * - Per-prediction attributions (weight_i * standardized x_i) sum exactly to the
 *   logit, so the "reasoning" shown to the user is verifiable.
 * - Consent-gated (transactions) exactly like every other tool.
 */
import { RiskFactor, RiskPrediction, ToolResult } from "../types";
import { checkConsent } from "./checkConsent";
import { getTransactionsForCustomer } from "../data";
import { extractFeatures, groupByMonth } from "../ml/riskFeatures";
import { attribute, predictProbability, standardize } from "../ml/logisticRegression";
// @ts-ignore — JSON module resolved via tsconfig resolveJsonModule
import artifact from "../../data/risk-model.json";

const RISK_ARTIFACT = artifact as {
  version: string;
  featureNames: string[];
  featureDescriptions: Record<string, string>;
  means: number[];
  stds: number[];
  weights: number[];
  bias: number;
};

export function riskBandOf(probability: number): RiskPrediction["riskBand"] {
  return probability < 0.33 ? "low" : probability < 0.66 ? "medium" : "high";
}

/**
 * Pure, deterministic inference given a raw feature vector + the artifact.
 * Exported for deterministic testing.
 */
export function predictRiskFromFeatures(
  features: number[]
): { probability: number; band: RiskPrediction["riskBand"]; topFactors: RiskFactor[] } {
  const probability = predictProbability(features, RISK_ARTIFACT);
  const standardized = standardize(features, {
    means: RISK_ARTIFACT.means,
    stds: RISK_ARTIFACT.stds,
  });
  const { contributions } = attribute(standardized, RISK_ARTIFACT.weights, RISK_ARTIFACT.bias);

  const factors: RiskFactor[] = RISK_ARTIFACT.featureNames
    .map((name, i) => ({
      feature: name,
      contribution: contributions[i],
      description: RISK_ARTIFACT.featureDescriptions[name] ?? name,
    }))
    .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution));

  return {
    probability,
    band: riskBandOf(probability),
    topFactors: factors.slice(0, 3),
  };
}

/** Consent-gated wrapper over real customer data. */
export function predictRiskScore(customerId: string): ToolResult<RiskPrediction> {
  const consentResult = checkConsent(customerId);

  if (!consentResult.output.consentGranted) {
    return {
      toolName: "predictRiskScore",
      output: {
        customerId,
        probability: 0,
        riskBand: "low",
        topFactors: [],
        modelVersion: RISK_ARTIFACT.version,
      },
      reasonTrace: [...consentResult.reasonTrace, "risk=blocked (consent denied)"],
      confidence: 1.0,
      timestamp: new Date(),
    };
  }

  const txns = getTransactionsForCustomer(customerId);
  const byMonth = groupByMonth(txns);
  const months = [...byMonth.keys()].sort();
  const lastMonth = months[months.length - 1];
  const prevMonthDebitTotal = (() => {
    const idx = months.indexOf(lastMonth);
    if (idx <= 0) return null;
    return (byMonth.get(months[idx - 1]) ?? [])
      .filter((t) => t.type === "debit")
      .reduce((sum, t) => sum + t.amount, 0);
  })();

  const features = extractFeatures(byMonth.get(lastMonth) ?? [], prevMonthDebitTotal);
  const { probability, band, topFactors } = predictRiskFromFeatures(features);

  const factorLines = topFactors.map(
    (f) =>
      `${f.feature} ${f.contribution >= 0 ? "+" : ""}${f.contribution.toFixed(3)} (${f.description})`
  );

  return {
    toolName: "predictRiskScore",
    output: {
      customerId,
      probability,
      riskBand: band,
      topFactors,
      modelVersion: RISK_ARTIFACT.version,
    },
    reasonTrace: [
      ...consentResult.reasonTrace,
      `risk_features.month=${lastMonth} (latest month in history)`,
      `ml_prediction=p=${probability.toFixed(3)} (band=${band}, model=${RISK_ARTIFACT.version})`,
      `attributions=[${factorLines.join(", ")}]`,
      "advisory_only=true (model never overrides the deterministic rule engine)",
    ],
    confidence: 1.0,
    timestamp: new Date(),
  };
}