import { Signals } from "../types";
import weights from "./weights.json";
import metrics from "./metrics.json";

/**
 * Runtime inference (ADR-027). Pure arithmetic over committed JSON weights —
 * no ML runtime, no native binary, no cold-start download.
 *
 * The governing rule, enforced in `detectStressSignals`:
 *
 *   **The model proposes. The rules dispose.**
 *
 * The score may raise concern about a customer (escalating them into support)
 * and may reorder what we show, but it can never unlock a product the
 * deterministic rules withheld, and it can never overrule the Wellness Gate.
 * A wrong model therefore costs a customer an offer, never their protection.
 */

export const MODEL_VERSION = weights.version;
export const MODEL_METRICS = metrics;

export interface FeatureContribution {
  feature: string;
  /** The customer's own value, in human units */
  value: number;
  /** Signed contribution to the log-odds — exact, because the model is additive */
  contribution: number;
  direction: "raises risk" | "lowers risk";
  label: string;
}

const FEATURE_LABELS: Record<string, string> = {
  savingsRate: "savings rate",
  emiMissCount90d: "missed EMIs (90 days)",
  spendVolatility30d: "spending volatility",
  salaryRegularityScore: "income regularity",
  logIncome: "income level",
  expenseRatio: "expense-to-income ratio",
};

function featurize(signals: Signals): number[] {
  const income = Math.max(1000, signals.monthlyIncome);
  return [
    signals.savingsRate,
    signals.emiMissCount90d,
    signals.spendVolatility30d,
    signals.salaryRegularityScore,
    Math.log(income),
    signals.monthlyExpense / income,
  ];
}

function humanValue(featureIndex: number, signals: Signals): number {
  const raw = featurize(signals);
  return featureIndex === 4 ? signals.monthlyIncome : raw[featureIndex];
}

function sigmoid(z: number): number {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

export interface DistressPrediction {
  probability: number;
  /** Above the trained threshold the model wants this customer escalated */
  escalates: boolean;
  threshold: number;
  contributions: FeatureContribution[];
  modelVersion: string;
}

export function predictDistress(signals: Signals): DistressPrediction {
  const raw = featurize(signals);
  const { mean, std } = weights.standardizer;
  const w = weights.distress.weights;

  const contributions: FeatureContribution[] = raw.map((v, j) => {
    const standardized = (v - mean[j]) / std[j];
    const contribution = standardized * w[j];
    return {
      feature: weights.features[j],
      value: Number(humanValue(j, signals).toFixed(4)),
      contribution: Number(contribution.toFixed(4)),
      direction: contribution >= 0 ? "raises risk" : "lowers risk",
      label: FEATURE_LABELS[weights.features[j]] ?? weights.features[j],
    };
  });

  const logit = contributions.reduce((acc, c) => acc + c.contribution, weights.distress.bias);
  const probability = sigmoid(logit);

  return {
    probability: Number(probability.toFixed(4)),
    escalates: probability >= weights.distress.escalationThreshold,
    threshold: weights.distress.escalationThreshold,
    // Strongest influence first — these are the "principal reasons".
    contributions: contributions.sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution)),
    modelVersion: weights.version,
  };
}

export interface SegmentAssignment {
  id: number;
  name: string;
  /** Share of the training population in this segment */
  share: number;
  /** Observed distress rate within the segment — context, not a verdict */
  distressRate: number;
  /** How far this customer sits from the centre of their segment (0 = centre) */
  distance: number;
  savingsPercentile: number;
}

export function assignSegment(signals: Signals): SegmentAssignment {
  const raw = featurize(signals).slice(0, 4);
  const { mean, std } = weights.standardizer;
  const point = raw.map((v, j) => (v - mean[j]) / std[j]);

  let best = weights.segments.clusters[0];
  let bestDistance = Infinity;
  for (const cluster of weights.segments.clusters) {
    const distance = Math.sqrt(
      cluster.centroid.reduce((acc, c, j) => acc + (point[j] - c) ** 2, 0)
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = cluster;
    }
  }

  return {
    id: best.id,
    name: best.name,
    share: best.share,
    distressRate: best.distressRate,
    distance: Number(bestDistance.toFixed(3)),
    savingsPercentile: savingsPercentile(signals.savingsRate),
  };
}

/** Where this savings rate sits in the trained population (0-100). */
export function savingsPercentile(savingsRate: number): number {
  const table = weights.savingsPercentiles;
  let low = 0;
  for (let p = 0; p < table.length; p++) {
    if (table[p] <= savingsRate) low = p;
    else break;
  }
  return low;
}
