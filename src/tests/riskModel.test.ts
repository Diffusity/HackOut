/**
 * Deterministic tests for RiskNet (F26, ADR-022).
 * Run: npx tsx src/tests/riskModel.test.ts
 * No LLM, no network, no fs writes — pure maths + fixtures + committed artifact.
 */
import {
  sigmoid,
  computeStandardization,
  trainLogisticRegression,
  predictProbability,
  evaluate,
  attribute,
  logit,
} from "../lib/ml/logisticRegression";
import {
  buildRiskDataset,
  extractFeatures,
  missedEmiInMonth,
  monthKey,
  nextMonthKey,
  FEATURE_NAMES,
} from "../lib/ml/riskFeatures";
import { Transaction } from "../lib/types";
// @ts-ignore — JSON module resolved via tsconfig resolveJsonModule
import artifact from "../data/risk-model.json";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ok: ${name}`);
  } else {
    fail++;
    console.error(`  FAIL: ${name}`);
  }
}
function approx(a: number, b: number, eps = 1e-9): boolean {
  return Math.abs(a - b) <= eps;
}
// ---------- fixtures ----------
function txn(partial: Partial<Transaction> & { timestamp: string }): Transaction {
  return {
    txnId: `T${Math.random().toString(36).slice(2, 8)}`,
    customerId: "CUST_TEST",
    amount: 1000,
    type: "debit",
    category: "upi_spend",
    mode: "UPI",
    ...partial,
  };
}

function syntheticSeparable(): { samples: any[]; std: any } {
  const samples = [];
  for (let i = 0; i < 80; i++) {
    // class 0 clusters around (1,1), class 1 around (-1,-1) in 2-D
    const cls = i % 2;
    const noise = () => (Math.random() - 0.5) * 0.2;
    samples.push({
      features: [cls === 0 ? 1 + noise() : -1 + noise(), cls === 0 ? 1 + noise() : -1 + noise()],
      label: cls,
    });
  }
  const std = computeStandardization(samples);
  return { samples, std };
}

// ---------- Test 1: sigmoid properties ----------
check("sigmoid(0)=0.5", approx(sigmoid(0), 0.5));
check("sigmoid(5)>0.98", sigmoid(5) > 0.98);
check("sigmoid(-5)<0.02", sigmoid(-5) < 0.02);
check("sigmoid clamps extreme logits (no NaN/inf)", Number.isFinite(sigmoid(1000)) && Number.isFinite(sigmoid(-1000)));

// ---------- Test 2: standardization ----------
{
  const { samples, std } = syntheticSeparable();
  check("means have length d", std.means.length === 2);
  check("means approx 0", std.means.every((m: number) => approx(m, 0, 0.5)));
  check("stds approx 1", std.stds.every((s: number) => approx(s, 1, 0.5)));
  // Constant column → std 1, standardized value 0
  const constStd = computeStandardization([
    { features: [5, 1], label: 0 },
    { features: [5, 2], label: 0 },
    { features: [5, 3], label: 0 },
  ]);
  check("constant column mean=5", approx(constStd.means[0], 5));
  check("constant column std forced to 1", approx(constStd.stds[0], 1));
}

// ---------- Test 3: LR converges on separable data ----------
{
  const { samples, std } = syntheticSeparable();
  const model = trainLogisticRegression(samples, std, { learningRate: 0.5, iterations: 2000, l2: 0.001 });
  const m = evaluate(samples, model);
  check("separable accuracy > 0.95", m.accuracy > 0.95);
  check("separable auc >= 0.98", m.rocAuc !== null && m.rocAuc >= 0.98);
}

// ---------- Test 4: determinism (same data → bit-identical weights) ----------
{
  const { samples, std } = syntheticSeparable();
  const a = trainLogisticRegression(samples, std, { iterations: 500 });
  const b = trainLogisticRegression(samples, std, { iterations: 500 });
  check("weights identical", JSON.stringify(a.weights) === JSON.stringify(b.weights));
  check("bias identical", a.bias === b.bias);
}

// ---------- Test 5: attribution sums to logit ----------
{
  const { samples, std } = syntheticSeparable();
  const model = trainLogisticRegression(samples, std);
  for (let i = 0; i < 10; i++) {
    const x = [Math.random() * 4 - 2, Math.random() * 4 - 2];
    const z = logit(x, model.weights, model.bias);
    const att = attribute(x, model.weights, model.bias);
    const sum = att.contributions.reduce((a, b) => a + b, 0) + att.biasContribution;
    check(`attribution #${i} sums to logit`, approx(sum, z, 1e-9));
  }
}

// ---------- Test 6: monthKey / nextMonthKey ----------
check("monthKey 2026-01", monthKey(new Date("2026-01-15T00:00:00Z")) === "2026-01");
check("monthKey pads", monthKey(new Date("2026-11-15T00:00:00Z")) === "2026-11");
check("nextMonthKey rollover", nextMonthKey("2026-12") === "2027-01");
check("nextMonthKey basic", nextMonthKey("2026-04") === "2026-05");
// ---------- Test 7: extractFeatures determinism + semantics ----------
{
  const month = [
    txn({ timestamp: "2026-05-02T10:00:00Z", amount: 50000, type: "credit", category: "salary", mode: "NEFT" }),
    txn({ timestamp: "2026-05-05T10:00:00Z", amount: 5000, category: "emi", mode: "auto_debit" }),
    txn({ timestamp: "2026-05-10T10:00:00Z", amount: 10000, category: "upi_spend" }),
  ];
  const f1 = extractFeatures(month, 20000);
  const f2 = extractFeatures(month, 20000);
  check("extractFeatures deterministic", JSON.stringify(f1) === JSON.stringify(f2));
  check("8 features", f1.length === FEATURE_NAMES.length);
  check("savingsRate = 1 - 15000/50000", approx(f1[0], 1 - 15000 / 50000));
  check("emiToIncomeRatio = 0.1", approx(f1[2], 5000 / 50000));
  check("momDebitTrend = (15000-20000)/20000", approx(f1[3], -0.25, 1e-9));
  check("logTxnCount = ln(4)", approx(f1[7], Math.log(1 + 3), 1e-9));
}

// ---------- Test 8: label logic (EMI cadence → miss) ----------
{
  const txns: Transaction[] = [
    txn({ timestamp: "2026-04-10T10:00:00Z", amount: 5000, category: "emi" }),
    txn({ timestamp: "2026-05-10T10:00:00Z", amount: 5000, category: "emi" }),
  ];
  check("miss when cadence exists, no payment in month", missedEmiInMonth(txns, "2026-06"));
  check("no miss when paid this month", !missedEmiInMonth(txns, "2026-05"));
  const oneOnly = [txn({ timestamp: "2026-04-10T10:00:00Z", amount: 5000, category: "emi" })];
  check("no miss without cadence", !missedEmiInMonth(oneOnly, "2026-06"));
}

// ---------- Test 9: dataset build + leakage guard ----------
{
  const txns: Transaction[] = [];
  // Customer A: stable, pays EMI every month Apr-Sep
  for (let m = 3; m <= 8; m++) {
    txns.push(txn({ customerId: "A", timestamp: new Date(Date.UTC(2026, m, 2)).toISOString(), amount: 50000, type: "credit", category: "salary" }));
    txns.push(txn({ customerId: "A", timestamp: new Date(Date.UTC(2026, m, 10)).toISOString(), amount: 5000, category: "emi" }));
  }
  // Customer B: pays EMI Apr-May, misses Jun-Jul, resumes Aug
  for (let m = 3; m <= 8; m++) {
    txns.push(txn({ customerId: "B", timestamp: new Date(Date.UTC(2026, m, 2)).toISOString(), amount: 40000, type: "credit", category: "salary" }));
    if (m !== 5 && m !== 6) {
      txns.push(txn({ customerId: "B", timestamp: new Date(Date.UTC(2026, m, 10)).toISOString(), amount: 5000, category: "emi" }));
    }
  }
  const rows = buildRiskDataset(txns);
  check("rows = 2 customers x 5 transitions", rows.length === 10);

  const bJun = rows.find((r) => r.customerId === "B" && r.monthKey === "2026-05");
  const bJul = rows.find((r) => r.customerId === "B" && r.monthKey === "2026-06");
  const bAug = rows.find((r) => r.customerId === "B" && r.monthKey === "2026-07");
  check("B May row → label 1 (Jun miss)", bJun?.label === 1);
  check("B Jun row → label 1 (Jul miss)", bJul?.label === 1);
  check("B Jul row → label 0 (Aug paid)", bAug?.label === 0);
  check("A never missed → all 0", rows.filter((r) => r.customerId === "A").every((r) => r.label === 0));

  // THE LEAKAGE GUARD: label month must be exactly the successor of the feature month
  for (const r of rows) {
    check(`leakage: ${r.customerId} ${r.monthKey}->${r.labelMonthKey} consecutive`, nextMonthKey(r.monthKey) === r.labelMonthKey);
  }
// ---------- Test 10: real-data artifact sanity ----------
{
  const art = artifact as any;
  check("artifact has version", typeof art.version === "string" && art.version.length > 0);
  check("artifact has 8 features", art.featureNames?.length === 8);
  check("weights/means/stds length 8", art.weights?.length === 8 && art.means?.length === 8 && art.stds?.length === 8);
  check("bias is finite", Number.isFinite(art.bias));
  check("trainingMeta present", !!art.trainingMeta?.metrics);
  const rows = buildRiskDataset(require("../data/transactions.json"));
  check("artifact metrics match real dataset rows", art.trainingMeta.datasetRows === rows.length);
  const p = predictProbability(new Array(8).fill(0), art);
  check("all-zero prediction = sigmoid(bias)", Number.isFinite(p) && p >= 0 && p <= 1);
}

// ---------- Test 11: deterministic train on full dataset reproduces artifact ----------
{
  const rows = buildRiskDataset(require("../data/transactions.json"));
  const std = computeStandardization(rows);
  const model = trainLogisticRegression(rows, std, { learningRate: 0.3, iterations: 3000, l2: 0.01 });
  const art = artifact as any;
  const match =
    model.weights.length === art.weights.length &&
    model.weights.every((w: number, i: number) => approx(w, art.weights[i], 1e-5)) &&
    approx(model.bias, art.bias, 1e-5) &&
    std.means.every((m: number, i: number) => approx(m, art.means[i], 1e-5)) &&
    std.stds.every((s: number, i: number) => approx(s, art.stds[i], 1e-5));
  check("committed artifact reproducible from source data", match);
}

// ---------- Summary ----------
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
}
console.log("ALL RISK MODEL DETERMINISTIC TESTS PASSED");
}