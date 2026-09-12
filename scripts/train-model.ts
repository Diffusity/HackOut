/**
 * Model training (ADR-027). Run: `npm run train`
 *
 * Trains two models offline and writes plain-JSON weights that the app loads
 * at runtime. Nothing is trained or downloaded in production: inference is a
 * dot product in TypeScript, so it costs microseconds, adds no dependency, and
 * survives Vercel's free tier without a Python runtime or a native binary.
 *
 * 1. Distress model — L2-regularised logistic regression with MONOTONIC SIGN
 *    CONSTRAINTS. Constraining each weight's sign means the model can never
 *    learn something indefensible from noise (e.g. "more missed EMIs = safer"),
 *    which is what makes an ML score usable in a lending decision at all.
 * 2. Segment model — k-means over behavioural features, for cohort comparison.
 *
 * Protected attributes (gender, city tier) are deliberately NOT features. They
 * are carried in the population only so the fairness audit can measure outcome
 * disparity across them.
 *
 * TO USE REAL DATA: replace `buildPopulation()` with a loader that maps your
 * ledger into the same `TrainingRow` shape. Nothing downstream changes.
 */
import fs from "fs";
import path from "path";

const OUT_DIR = path.join(process.cwd(), "src", "lib", "ml");


import { buildPopulation, featurize, FEATURE_NAMES, MONOTONIC_SIGNS, SEED } from "./population";

// ---------------------------------------------------------------- training

interface Standardizer {
  mean: number[];
  std: number[];
}

function fitStandardizer(X: number[][]): Standardizer {
  const d = X[0].length;
  const mean = new Array(d).fill(0);
  const std = new Array(d).fill(0);
  for (const x of X) for (let j = 0; j < d; j++) mean[j] += x[j] / X.length;
  for (const x of X) for (let j = 0; j < d; j++) std[j] += (x[j] - mean[j]) ** 2 / X.length;
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j]) || 1;
  return { mean, std };
}

function standardize(x: number[], s: Standardizer): number[] {
  return x.map((v, j) => (v - s.mean[j]) / s.std[j]);
}

function sigmoid(z: number): number {
  return z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z));
}

function trainLogistic(
  X: number[][],
  y: number[],
  opts: { epochs: number; lr: number; l2: number }
): { weights: number[]; bias: number } {
  const d = X[0].length;
  let weights = new Array(d).fill(0);
  let bias = 0;

  for (let epoch = 0; epoch < opts.epochs; epoch++) {
    const gradW = new Array(d).fill(0);
    let gradB = 0;

    for (let i = 0; i < X.length; i++) {
      const z = X[i].reduce((acc, v, j) => acc + v * weights[j], bias);
      const error = sigmoid(z) - y[i];
      for (let j = 0; j < d; j++) gradW[j] += (error * X[i][j]) / X.length;
      gradB += error / X.length;
    }

    for (let j = 0; j < d; j++) {
      weights[j] -= opts.lr * (gradW[j] + opts.l2 * weights[j]);
      // Monotonic projection: a weight may never take the indefensible sign.
      const sign = MONOTONIC_SIGNS[FEATURE_NAMES[j]];
      if (sign === 1 && weights[j] < 0) weights[j] = 0;
      if (sign === -1 && weights[j] > 0) weights[j] = 0;
    }
    bias -= opts.lr * gradB;
  }

  return { weights, bias };
}

// ---------------------------------------------------------------- metrics

function auc(scores: number[], labels: number[]): number {
  const pairs = scores.map((s, i) => ({ s, y: labels[i] })).sort((a, b) => a.s - b.s);
  let rankSum = 0;
  let positives = 0;
  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].y === 1) {
      rankSum += i + 1;
      positives++;
    }
  }
  const negatives = pairs.length - positives;
  if (positives === 0 || negatives === 0) return 0.5;
  return (rankSum - (positives * (positives + 1)) / 2) / (positives * negatives);
}

function calibration(scores: number[], labels: number[], bins = 10) {
  const out: { bin: string; predicted: number; observed: number; count: number }[] = [];
  for (let b = 0; b < bins; b++) {
    const lo = b / bins;
    const hi = (b + 1) / bins;
    const idx = scores.map((s, i) => ({ s, i })).filter(({ s }) => s >= lo && s < hi);
    if (idx.length === 0) continue;
    out.push({
      bin: `${Math.round(lo * 100)}-${Math.round(hi * 100)}%`,
      predicted: Number((idx.reduce((a, { s }) => a + s, 0) / idx.length).toFixed(4)),
      observed: Number((idx.reduce((a, { i }) => a + labels[i], 0) / idx.length).toFixed(4)),
      count: idx.length,
    });
  }
  return out;
}

/**
 * Cost of an error, and why these numbers.
 *
 * A false positive costs us one suppressed sales offer. A false negative means
 * a customer heading into distress gets sold credit instead of support — the
 * exact harm this product exists to prevent. We price that at 10× and pick the
 * operating point that minimises total cost, rather than the point that
 * maximises accuracy (at a 7% base rate, "predict nobody is at risk" is 93%
 * accurate and worthless).
 */
const OPERATING_POINTS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.4, 0.5, 0.6, 0.7];
const FALSE_NEGATIVE_COST = 10;
const FALSE_POSITIVE_COST = 1;
/**
 * Intervention capacity. A bank can only act on so many flags, and flagging
 * half the book would make the signal meaningless, so we minimise cost SUBJECT
 * TO flagging at most this share of customers.
 */
const MAX_FLAG_RATE = 0.2;

function confusionAt(scores: number[], labels: number[], threshold: number) {
  let tp = 0, fp = 0, tn = 0, fn = 0;
  scores.forEach((s, i) => {
    const predicted = s >= threshold ? 1 : 0;
    if (predicted === 1 && labels[i] === 1) tp++;
    else if (predicted === 1 && labels[i] === 0) fp++;
    else if (predicted === 0 && labels[i] === 0) tn++;
    else fn++;
  });
  const precision = tp + fp === 0 ? 0 : tp / (tp + fp);
  const recall = tp + fn === 0 ? 0 : tp / (tp + fn);
  return {
    threshold,
    tp, fp, tn, fn,
    precision: Number(precision.toFixed(4)),
    recall: Number(recall.toFixed(4)),
    f1: Number((precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall)).toFixed(4)),
    cost: fn * FALSE_NEGATIVE_COST + fp * FALSE_POSITIVE_COST,
    flagRate: Number(((tp + fp) / scores.length).toFixed(4)),
  };
}

// ---------------------------------------------------------------- k-means

function kmeans(X: number[][], k: number, iterations = 60) {
  const centroids: number[][] = [];
  const step = Math.floor(X.length / k);
  for (let i = 0; i < k; i++) centroids.push([...X[i * step]]);

  let assignments = new Array(X.length).fill(0);
  for (let iter = 0; iter < iterations; iter++) {
    let moved = false;
    for (let i = 0; i < X.length; i++) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < k; c++) {
        let dist = 0;
        for (let j = 0; j < X[i].length; j++) dist += (X[i][j] - centroids[c][j]) ** 2;
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      if (assignments[i] !== best) moved = true;
      assignments[i] = best;
    }
    for (let c = 0; c < k; c++) {
      const members = X.filter((_, i) => assignments[i] === c);
      if (members.length === 0) continue;
      for (let j = 0; j < X[0].length; j++) {
        centroids[c][j] = members.reduce((a, m) => a + m[j], 0) / members.length;
      }
    }
    if (!moved) break;
  }
  return { centroids, assignments };
}

/**
 * Names clusters by rank, so the four labels are always distinct and each one
 * describes how that cluster actually differs from the others. Naming by
 * absolute thresholds produced duplicate labels, which is useless in the UI.
 */
function nameClusters(centroids: number[][], standardizer: Standardizer): string[] {
  const raw = centroids.map((c) => c.map((v, j) => v * standardizer.std[j] + standardizer.mean[j]));
  const names = new Array<string>(centroids.length).fill("");
  const remaining = new Set(centroids.map((_, i) => i));

  const take = (name: string, pick: (i: number) => number) => {
    let best = -1;
    let bestScore = -Infinity;
    for (const i of remaining) {
      const s = pick(i);
      if (s > bestScore) {
        bestScore = s;
        best = i;
      }
    }
    if (best >= 0) {
      names[best] = name;
      remaining.delete(best);
    }
  };

  take("Under pressure", (i) => raw[i][1]);       // most missed EMIs
  take("Disciplined saver", (i) => raw[i][0]);    // highest savings rate
  take("Steady earner", (i) => raw[i][3]);        // most regular income
  take("Variable income", () => 0);               // whatever remains
  return names;
}

// ---------------------------------------------------------------- main

function main() {
  console.log(`Building population (seed ${SEED})...`);
  const population = buildPopulation();
  const positives = population.filter((r) => r.distressed === 1).length;
  console.log(`  ${population.length} rows, ${positives} distressed (${((positives / population.length) * 100).toFixed(1)}%)`);

  const rawX = population.map(featurize);
  const y = population.map((r) => r.distressed);

  // Deterministic 80/20 split — no shuffling, the population is already random.
  const splitAt = Math.floor(rawX.length * 0.8);
  const standardizer = fitStandardizer(rawX.slice(0, splitAt));
  const X = rawX.map((x) => standardize(x, standardizer));

  const trainX = X.slice(0, splitAt);
  const trainY = y.slice(0, splitAt);
  const testX = X.slice(splitAt);
  const testY = y.slice(splitAt);

  console.log("Training distress model (monotonic-constrained logistic regression)...");
  const { weights, bias } = trainLogistic(trainX, trainY, { epochs: 900, lr: 0.35, l2: 0.002 });

  const score = (x: number[]) => sigmoid(x.reduce((a, v, j) => a + v * weights[j], bias));
  const trainScores = trainX.map(score);
  const testScores = testX.map(score);

  const metrics = {
    seed: SEED,
    trainedAt: new Date().toISOString(),
    populationSize: population.length,
    positiveRate: Number((positives / population.length).toFixed(4)),
    trainAuc: Number(auc(trainScores, trainY).toFixed(4)),
    testAuc: Number(auc(testScores, testY).toFixed(4)),
    calibration: calibration(testScores, testY),
    operatingPoints: OPERATING_POINTS.map((t) => confusionAt(testScores, testY, t)),
    thresholdPolicy: {
      falseNegativeCost: FALSE_NEGATIVE_COST,
      falsePositiveCost: FALSE_POSITIVE_COST,
      maxFlagRate: MAX_FLAG_RATE,
      rationale:
        "A false positive costs one suppressed offer. A false negative sells credit to someone sliding into distress. We price the miss at 10x and minimise total cost, subject to flagging no more than 20% of customers so interventions stay actionable.",
    },
    cohortPerformance: (["F", "M"] as const)
      .map((g) => {
        const idx = population
          .map((r, i) => ({ r, i }))
          .filter(({ r, i }) => r.gender === g && i >= splitAt);
        return {
          cohort: `gender=${g}`,
          count: idx.length,
          auc: Number(auc(idx.map(({ i }) => score(X[i])), idx.map(({ r }) => r.distressed)).toFixed(4)),
          positiveRate: Number((idx.reduce((a, { r }) => a + r.distressed, 0) / idx.length).toFixed(4)),
        };
      })
      .concat(
        ([2, 3, 4] as const).map((tier) => {
          const idx = population
            .map((r, i) => ({ r, i }))
            .filter(({ r, i }) => r.cityTier === tier && i >= splitAt);
          return {
            cohort: `cityTier=${tier}`,
            count: idx.length,
            auc: Number(auc(idx.map(({ i }) => score(X[i])), idx.map(({ r }) => r.distressed)).toFixed(4)),
            positiveRate: Number((idx.reduce((a, { r }) => a + r.distressed, 0) / idx.length).toFixed(4)),
          };
        })
      ),
  };

  const affordable = metrics.operatingPoints.filter((p) => p.flagRate <= MAX_FLAG_RATE);
  const chosen = (affordable.length ? affordable : metrics.operatingPoints).reduce((best, p) =>
    p.cost < best.cost ? p : best
  );
  console.log(`  train AUC ${metrics.trainAuc} / test AUC ${metrics.testAuc}`);
  console.log(`  chosen threshold ${chosen.threshold} (recall ${chosen.recall}, precision ${chosen.precision}, cost ${chosen.cost})`);

  console.log("Training segment model (k-means, k=4)...");
  const segX = X.map((x) => [x[0], x[1], x[2], x[3]]);
  const segStandardizer = { mean: standardizer.mean.slice(0, 4), std: standardizer.std.slice(0, 4) };
  const { centroids, assignments } = kmeans(segX, 4);
  const clusterNames = nameClusters(centroids, segStandardizer);
  const clusters = centroids.map((c, i) => {
    const members = assignments.filter((a) => a === i).length;
    return {
      id: i,
      name: clusterNames[i],
      centroid: c.map((v) => Number(v.toFixed(5))),
      share: Number((members / assignments.length).toFixed(4)),
      distressRate: Number(
        (
          population.filter((_, idx) => assignments[idx] === i).reduce((a, r) => a + r.distressed, 0) /
          Math.max(1, members)
        ).toFixed(4)
      ),
    };
  });
  clusters.forEach((c) => console.log(`  cluster ${c.id}: ${c.name} (${(c.share * 100).toFixed(1)}%, distress ${(c.distressRate * 100).toFixed(1)}%)`));

  // Savings-rate percentile table, for honest cohort comparison in the UI.
  const sortedSavings = [...population.map((r) => r.savingsRate)].sort((a, b) => a - b);
  const percentiles = Array.from({ length: 101 }, (_, p) =>
    Number(sortedSavings[Math.min(sortedSavings.length - 1, Math.floor((p / 100) * sortedSavings.length))].toFixed(4))
  );

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(
    path.join(OUT_DIR, "weights.json"),
    JSON.stringify(
      {
        version: "1.0.0",
        seed: SEED,
        features: FEATURE_NAMES,
        monotonicSigns: MONOTONIC_SIGNS,
        standardizer: {
          mean: standardizer.mean.map((v) => Number(v.toFixed(6))),
          std: standardizer.std.map((v) => Number(v.toFixed(6))),
        },
        distress: {
          weights: weights.map((w) => Number(w.toFixed(6))),
          bias: Number(bias.toFixed(6)),
          /** Above this the model may escalate concern; it can never lower it. */
          escalationThreshold: chosen.threshold,
        },
        segments: { features: FEATURE_NAMES.slice(0, 4), clusters },
        savingsPercentiles: percentiles,
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(OUT_DIR, "metrics.json"), JSON.stringify(metrics, null, 2));

  console.log(`\nWrote ${path.relative(process.cwd(), OUT_DIR)}/weights.json and metrics.json`);
}

main();
