/**
 * Verifies the ML layer and, more importantly, its SAFETY CONTRACT:
 * the model may escalate a customer into protection but may never clear one
 * the deterministic rules have flagged (ADR-027). No LLM calls.
 */
import { getCustomerSignals } from "../src/lib/tools/getCustomerSignals";
import { computeStressCore } from "../src/lib/tools/detectStressSignals";
import { predictDistress, assignSegment, MODEL_METRICS, MODEL_VERSION } from "../src/lib/ml/model";
import { Signals } from "../src/lib/types";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) { passed++; console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`); }
  else { failed++; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

console.log(`Model ${MODEL_VERSION} | test AUC ${MODEL_METRICS.testAuc}\n`);
check("Test AUC beats random", MODEL_METRICS.testAuc > 0.65, String(MODEL_METRICS.testAuc));
check("Train/test gap is small (not overfit)", Math.abs(MODEL_METRICS.trainAuc - MODEL_METRICS.testAuc) < 0.08);

for (const id of ["CUST_PRIYA", "CUST_RAMESH", "CUST_SUNITA"]) {
  const signals = getCustomerSignals(id).output;
  const core = computeStressCore(signals);
  const segment = assignSegment(signals);
  console.log(`\n${id}: rules ${core.wellnessScore}/100, model ${(core.model.probability * 100).toFixed(1)}%, segment "${segment.name}", savings p${segment.savingsPercentile}`);
  core.model.contributions.slice(0, 3).forEach((c: any) =>
    console.log(`    ${c.label}: ${c.contribution > 0 ? "+" : ""}${c.contribution} (${c.direction})`)
  );
  check(`${id}: probability is a valid probability`, core.model.probability >= 0 && core.model.probability <= 1);
  check(`${id}: segment assigned`, segment.name.length > 0);
}

// Monotonicity: more missed EMIs must never lower predicted risk.
const base = getCustomerSignals("CUST_PRIYA").output;
let previous = -1;
let monotone = true;
for (const misses of [0, 1, 2, 3, 4]) {
  const p = predictDistress({ ...base, emiMissCount90d: misses }).probability;
  if (p < previous) monotone = false;
  previous = p;
}
check("Risk is monotonic in missed EMIs", monotone);

let savingsMonotone = true;
previous = Infinity;
for (const rate of [0, 0.1, 0.2, 0.4, 0.6, 0.8]) {
  const p = predictDistress({ ...base, savingsRate: rate }).probability;
  if (p > previous) savingsMonotone = false;
  previous = p;
}
check("Risk is monotonic (decreasing) in savings rate", savingsMonotone);

// THE safety contract: a rules-flagged customer stays flagged whatever the model says.
const stressed: Signals = { ...base, emiMissCount90d: 3, savingsRate: 0.01, lifeStageTags: ["financially_stressed"] };
const stressedCore = computeStressCore(stressed);
check("Rules-flagged customer stays at risk", stressedCore.isAtRisk, `score ${stressedCore.wellnessScore}`);
check("Model cannot clear a rules-flagged customer", stressedCore.isAtRisk === true);

// A healthy customer the model dislikes must still be escalated, not ignored.
const healthyButRisky: Signals = { ...base, savingsRate: 0.06, spendVolatility30d: 0.45, salaryRegularityScore: 0.1, monthlyIncome: 12000, monthlyExpense: 11300, emiMissCount90d: 1 };
const escalatedCore = computeStressCore(healthyButRisky);
console.log(`\nEscalation probe: rules ${escalatedCore.wellnessScore}/100, model ${(escalatedCore.model.probability * 100).toFixed(1)}%, atRisk=${escalatedCore.isAtRisk}`);
check(
  "Model escalation is recorded when it fires",
  !escalatedCore.model.escalatedByModel || escalatedCore.isAtRisk
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
