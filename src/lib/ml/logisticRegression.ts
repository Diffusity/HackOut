/**
 * RiskNet — from-scratch logistic regression (Feature 26, ADR-022).
 *
 * Pure TypeScript. No ML libraries, no dependencies.
 * Deterministic: fixed-iteration batch gradient descent, no sampling.
 *
 * Design notes:
 * - Standardization (z-score) is part of the pipeline; means/stds are returned
 *   so they can be persisted in the model artifact and reused at inference.
 * - L2 regularization keeps weights small on tiny datasets (~90 rows).
 * - Class weighting compensates for label imbalance (EMI misses are rare).
 * - Attributions: contribution_i = weight_i * standardized_x_i. These sum
 *   exactly to the logit (bias is the constant contribution), which gives a
 *   testable invariant and per-prediction explainability.
 */

export interface TrainingSample {
  features: number[];
  label: number; // 0 or 1
}

export interface Standardization {
  means: number[];
  stds: number[];
}

export interface LRModel {
  featureNames: string[];
  means: number[];
  stds: number[];
  weights: number[];
  bias: number;
}

export interface LRMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  rocAuc: number | null; // null when only one class present
}

export const SIGMOID_CLAMP = 30; // keeps exp() in range for extreme logits

export function sigmoid(z: number): number {
  const zz = Math.max(-SIGMOID_CLAMP, Math.min(SIGMOID_CLAMP, z));
  return 1 / (1 + Math.exp(-zz));
}

/** Compute means/stds per feature column. Zero-variance columns get std=1. */
export function computeStandardization(samples: TrainingSample[]): Standardization {
  const n = samples.length;
  const d = samples[0].features.length;
  const means = new Array<number>(d).fill(0);
  const stds = new Array<number>(d).fill(0);

  for (const s of samples) {
    for (let j = 0; j < d; j++) means[j] += s.features[j];
  }
  for (let j = 0; j < d; j++) means[j] /= n;

  for (const s of samples) {
    for (let j = 0; j < d; j++) {
      const diff = s.features[j] - means[j];
      stds[j] += diff * diff;
    }
  }
  for (let j = 0; j < d; j++) {
    stds[j] = Math.sqrt(stds[j] / n);
    if (stds[j] < 1e-9) stds[j] = 1; // constant column — standardized value becomes 0
  }
  return { means, stds };
}

export function standardize(features: number[], std: Standardization): number[] {
  return features.map((v, j) => (v - std.means[j]) / std.stds[j]);
}

export function logit(standardizedFeatures: number[], weights: number[], bias: number): number {
  let z = bias;
  for (let j = 0; j < weights.length; j++) z += weights[j] * standardizedFeatures[j];
  return z;
}

/** Per-prediction attributions. Contributions sum to the logit exactly. */
export function attribute(
  standardizedFeatures: number[],
  weights: number[],
  bias: number
): { contributions: number[]; biasContribution: number } {
  const contributions = standardizedFeatures.map((x, j) => weights[j] * x);
  const sum = contributions.reduce((a, b) => a + b, 0);
  return { contributions, biasContribution: logit(standardizedFeatures, weights, bias) - sum };
}

export interface TrainOptions {
  learningRate?: number;
  iterations?: number;
  l2?: number;
  classWeightPositive?: number; // weight for label=1 samples (default: balanced)
}

/**
 * Batch gradient descent with L2 + balanced class weighting. Deterministic.
 * Samples are in raw feature space; standardization is applied internally
 * using the provided `std` (compute once, reuse for inference).
 */
export function trainLogisticRegression(
  samples: TrainingSample[],
  std: Standardization,
  opts: TrainOptions = {}
): LRModel {
  const lr = opts.learningRate ?? 0.1;
  const iterations = opts.iterations ?? 2000;
  const l2 = opts.l2 ?? 0.01;

  const n = samples.length;
  const d = samples[0].features.length;
  const posCount = samples.reduce((acc, s) => acc + s.label, 0);
  const negCount = n - posCount;
  const wPos =
    opts.classWeightPositive ?? (posCount > 0 && negCount > 0 ? negCount / posCount : 1);

  const X = samples.map((s) => standardize(s.features, std));

  const weights = new Array<number>(d).fill(0);
  let bias = 0;

  for (let it = 0; it < iterations; it++) {
    const gradW = new Array<number>(d).fill(0);
    let gradB = 0;
    let totalWeight = 0;

    for (let i = 0; i < n; i++) {
      const w = samples[i].label === 1 ? wPos : 1;
      totalWeight += w;
      const p = sigmoid(logit(X[i], weights, bias));
      const err = (p - samples[i].label) * w;
      gradB += err;
      for (let j = 0; j < d; j++) gradW[j] += err * X[i][j];
    }

    // L2 (not applied to bias)
    for (let j = 0; j < d; j++) {
      weights[j] -= lr * (gradW[j] / totalWeight + l2 * weights[j]);
    }
    bias -= lr * (gradB / totalWeight);
  }

  return { featureNames: [], means: std.means, stds: std.stds, weights, bias };
}

export function predictProbability(
  rawFeatures: number[],
  model: Pick<LRModel, "means" | "stds" | "weights" | "bias">
): number {
  const x = standardize(rawFeatures, { means: model.means, stds: model.stds });
  return sigmoid(logit(x, model.weights, model.bias));
}

export interface EvalMetrics {
  accuracy: number;
  precision: number;
  recall: number;
  rocAuc: number | null; // null when only one class present
}

/** Confusion-matrix metrics at threshold 0.5 + rank-based ROC-AUC. */
export function evaluate(
  samples: TrainingSample[],
  model: Pick<LRModel, "means" | "stds" | "weights" | "bias">
): EvalMetrics {
  const probs = samples.map((s) => predictProbability(s.features, model));
  const labels = samples.map((s) => s.label);

  let tp = 0, fp = 0, tn = 0, fn = 0;
  probs.forEach((p, i) => {
    const pred = p >= 0.5 ? 1 : 0;
    if (pred === 1 && labels[i] === 1) tp++;
    else if (pred === 1 && labels[i] === 0) fp++;
    else if (pred === 0 && labels[i] === 0) tn++;
    else fn++;
  });

  return {
    accuracy: (tp + tn) / samples.length,
    precision: tp + fp > 0 ? tp / (tp + fp) : 0,
    recall: tp + fn > 0 ? tp / (tp + fn) : 0,
    rocAuc: computeAuc(probs, labels),
  };
}

/** Rank-based AUC (Mann-Whitney U, ties get 0.5); null when single-class. */
function computeAuc(probs: number[], labels: number[]): number | null {
  const nPos = labels.reduce((a, l) => a + l, 0);
  const nNeg = labels.length - nPos;
  if (nPos === 0 || nNeg === 0) return null;

  const all = probs.map((p, i) => ({ p, label: labels[i] })).sort((a, b) => a.p - b.p);
  const ranks = new Array<number>(all.length);
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].p === all[i].p) j++;
    const avgRank = (i + j) / 2 + 1; // 1-based average rank for the tie group
    for (let k = i; k <= j; k++) ranks[k] = avgRank;
    i = j + 1;
  }
  const posRankSum = all.reduce((acc, s, k) => acc + (s.label === 1 ? ranks[k] : 0), 0);
  return (posRankSum - (nPos * (nPos + 1)) / 2) / (nPos * nNeg);
}

