/**
 * Verify script — RiskNet ML risk predictions for the 3 demo personas (F26).
 * Run: npm run risk
 * Asserts the advisory-only contract, reason traces, and persona expectations.
 */
import { predictRiskScore } from "../src/lib/tools/predictRiskScore";

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

console.log("Verify RiskNet (F26):");
console.log("──────────────────────");

for (const id of ["CUST_PRIYA", "CUST_SUNITA", "CUST_RAMESH"]) {
  const r = predictRiskScore(id);
  const out = r.output;
  console.log(`\n${id}: p=${out.probability.toFixed(3)} band=${out.riskBand} model=${out.modelVersion}`);
  console.log(`  top factors: ${out.topFactors.map((f) => `${f.feature}=${f.contribution.toFixed(3)}`).join(", ")}`);
  console.log(`  reasonTrace: ${r.reasonTrace.join(" | ")}`);

  // Contract checks
  check(`${id}: probability in [0,1]`, out.probability >= 0 && out.probability <= 1);
  check(`${id}: riskBand matches thresholds`, (out.probability < 0.33 ? out.riskBand === "low" : out.probability < 0.66 ? out.riskBand === "medium" : out.riskBand === "high"));
  check(`${id}: topFactors sorted (|contrib| desc)`, out.topFactors.every((f, i, arr) => i === 0 || Math.abs(arr[i - 1].contribution) >= Math.abs(f.contribution)));
  check(`${id}: advisory_only stated in trace`, r.reasonTrace.some((l) => l.includes("advisory_only=true")));
  check(`${id}: model version set`, typeof out.modelVersion === "string" && out.modelVersion.length > 0);
}

// Persona expectations from the real synthetic data
const sunita = predictRiskScore("CUST_SUNITA");
check("Sunita: high risk band", sunita.output.riskBand === "high");
check("Sunita: probability > 0.5", sunita.output.probability > 0.5);
const priya = predictRiskScore("CUST_PRIYA");
check("Priya: low risk band", priya.output.riskBand === "low");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);
console.log("VERIFY RISK PASSED");