/**
 * RiskNet trainer (Feature 26, ADR-022) — from-scratch logistic regression.
 *
 * Deterministic: no sampling, no shuffling, fixed iterations.
 * Re-running this script produces a bit-identical artifact.
 *
 * Data contract (leakage-free, enforced by src/lib/ml/riskFeatures.ts):
 *   features from month m  →  label from month m+1 (EMI missed).
 *
 * Output artifact: src/data/risk-model.json (committed).
 *   Inference at request time only loads this file — never trains.
 */
import fs from "fs";
import path from "path";
import transactions from "../src/data/transactions.json";
import {
  buildRiskDataset,
  FEATURE_NAMES,
  FEATURE_DESCRIPTIONS,
  RiskRow,
} from "../src/lib/ml/riskFeatures";
import {
  computeStandardization,
  trainLogisticRegression,
  evaluate,
  TrainingSample,
  LRModel,
} from "../src/lib/ml/logisticRegression";

const ARTIFACT_PATH = path.join(process.cwd(), "src", "data", "risk-model.json");
const MODEL_VERSION = "risknet-1.0";

/** Leave-one-customer-out CV — honest generalization estimate. */
function locoCrossValidate(rows: RiskRow[], std: ReturnType<typeof computeStandardization>) {
  const customers = [...new Set(rows.map((r) => r.customerId))].sort();
  const yTrue: number[] = [];
  const yScore: number[] = [];

  for (const held of customers) {
    const train = rows.filter((r) => r.customerId !== held);
    const test = rows.filter((r) => r.customerId === held);
    if (new Set(train.map((r) => r.label)).size < 2) continue; // need both classes to train
    const model = trainLogisticRegression(train as TrainingSample[], std, {
      learningRate: 0.3,
      iterations: 3000,
      l2: 0.01,
    });
    for (const r of test) {
      yTrue.push(r.label);
      yScore.push(model.weights.reduce((z, w, j) => z + w * ((r.features[j] - std.means[j]) / std.stds[j]), model.bias));
    }
  }
  return { yTrue, yScore };
}

function auc(yTrue: number[], yScore: number[]): number | null {
  const pos = yTrue.filter((l) => l === 1).length;
  const neg = yTrue.length - pos;
  if (pos === 0 || neg === 0) return null;
  const paired = yScore
    .map((s, i) => ({ s, l: yTrue[i] }))
    .sort((a, b) => a.s - b.s);
  const ranks = new Array<number>(paired.length);
  let i = 0;
  while (i < paired.length) {
    let j = i;
    while (j + 1 < paired.length && paired[j + 1].s === paired[i].s) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[k] = avg;
    i = j + 1;
  }
  const posRankSum = paired.reduce((a, p, k) => a + (p.l === 1 ? ranks[k] : 0), 0);
  return (posRankSum - (pos * (pos + 1)) / 2) / (pos * neg);
}

function main() {
  console.log("── RiskNet trainer (from-scratch logistic regression) ──\n");

  const rows = buildRiskDataset(transactions as any);
  const posCount = rows.filter((r) => r.label === 1).length;
  console.log(`dataset: ${rows.length} customer-month rows, ${posCount} positive (EMI missed next month)`);
  if (posCount === 0) {
    console.error("❌ No positive labels — cannot train. Check EMI cadence in transactions.");
    process.exit(1);
  }

  const std = computeStandardization(rows);
  const model = trainLogisticRegression(rows as TrainingSample[], std, {
    learningRate: 0.3,
    iterations: 3000,
    l2: 0.01,
  });

  const trainMetrics = evaluate(rows as TrainingSample[], model);

  // In-sample weights are the explainability story; LOCO-CV is the honesty story.
  const cvv = locoCrossValidate(rows, std);
  const cvAuc = auc(cvv.yTrue, cvv.yScore);
  const cvAcc =
    cvv.yTrue.length > 0
      ? cvv.yTrue.filter((t, i) => (cvv.yScore[i] >= 0.5 ? 1 : 0) === t).length / cvv.yTrue.length
      : 0;

  console.log(`train:      acc=${trainMetrics.accuracy.toFixed(3)} prec=${trainMetrics.precision.toFixed(3)} rec=${trainMetrics.recall.toFixed(3)} auc=${trainMetrics.rocAuc?.toFixed(3) ?? "n/a"}`);
  console.log(`LOCO-CV:    acc=${cvAcc.toFixed(3)} auc=${cvAuc?.toFixed(3) ?? "n/a"} (${cvv.yTrue.length} held-out predictions)`);
  console.log("\nweights (the model's brain — readable):");
  FEATURE_NAMES.forEach((name, j) => {
    console.log(`  ${model.weights[j] >= 0 ? "+" : ""}${model.weights[j].toFixed(4)}  ${name}  (${FEATURE_DESCRIPTIONS[name]})`);
  });
  console.log(`  bias=${model.bias.toFixed(4)}`);

  const artifact = {
    version: MODEL_VERSION,
    featureNames: [...FEATURE_NAMES],
    featureDescriptions: FEATURE_DESCRIPTIONS,
    means: model.means.map((v) => round(v)),
    stds: model.stds.map((v) => round(v)),
    weights: model.weights.map((v) => round(v)),
    bias: round(model.bias),
    trainingMeta: {
      // Deterministic stamp derived from the data (bit-identical across runs)
      generatedFromHash: dataHash(),
      datasetRows: rows.length,
      positiveRows: posCount,
      hyperparams: { learningRate: 0.3, iterations: 3000, l2: 0.01, classWeighting: "balanced" },
      metrics: {
        trainAccuracy: round(trainMetrics.accuracy),
        trainPrecision: round(trainMetrics.precision),
        trainRecall: round(trainMetrics.recall),
        trainAuc: trainMetrics.rocAuc === null ? null : round(trainMetrics.rocAuc),
        locoCvAccuracy: round(cvAcc),
        locoCvAuc: cvAuc === null ? null : round(cvAuc),
        locoCvPredictions: cvv.yTrue.length,
      },
      caveat:
        "Trained on ~75 synthetic customer-month rows with only a handful of positives. Experimental, advisory-only; never used for compliance decisions (ADR-022).",
    },
  };

  fs.writeFileSync(ARTIFACT_PATH, JSON.stringify(artifact, null, 2) + "\n");
  console.log(`\n✅ artifact written: ${ARTIFACT_PATH}`);
}

/** SHA-256 of the serialized feature rows — deterministic provenance stamp. */
function dataHash(): string {
  const crypto = require("crypto") as typeof import("crypto");
  const rows = buildRiskDataset(transactions as any);
  const canonical = JSON.stringify(
    rows.map((r) => ({ cid: r.customerId, m: r.monthKey, f: r.features, l: r.label }))
  );
  return crypto.createHash("sha256").update(canonical).digest("hex").slice(0, 12);
}

function round(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

main();
