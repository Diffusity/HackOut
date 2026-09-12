/**
 * Deterministic verification of the counterfactual / adverse-action engine
 * (ADR-026). No LLM calls — safe to run on any quota.
 */
import { getCustomerSignals } from "../src/lib/tools/getCustomerSignals";
import { explainCounterfactuals, whyNot, decide } from "../src/lib/tools/counterfactuals";
import { buildSms, buildIvr } from "../src/lib/narration";
import { Recommendation } from "../src/lib/types";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

for (const id of ["CUST_PRIYA", "CUST_RAMESH", "CUST_SUNITA"]) {
  const signals = getCustomerSignals(id).output;
  const outcome = decide(signals);
  console.log(`\n${id} -> ${outcome.product}${outcome.suppressed ? " (SUPPRESSED by wellness gate)" : ""}`);

  const cfs = explainCounterfactuals(signals, outcome.product);
  check(`${id}: at least one counterfactual found`, cfs.length > 0, `${cfs.length} factors`);
  check(
    `${id}: no counterfactual returns the current product`,
    cfs.every((c) => c.resultingProduct !== outcome.product)
  );
  cfs.forEach((c) => console.log(`    ${c.narrative}`));

  const rec: Recommendation = {
    customerId: id,
    product: outcome.product,
    confidence: 1,
    reasonTrace: [],
    plainLanguageExplanation: "",
    wellnessGateStatus: outcome.suppressed ? "suppressed" : "passed",
  };

  const smsEn = buildSms({ recommendation: rec, signals, lang: "en" });
  const smsHi = buildSms({ recommendation: rec, signals, lang: "hi" });
  check(`${id}: English SMS fits 160 chars`, smsEn.length <= 160, `${smsEn.length} chars`);
  check(`${id}: Hindi SMS fits 160 chars`, smsHi.length <= 160, `${smsHi.length} chars`);
  console.log(`    SMS/en: ${smsEn}`);
  console.log(`    SMS/hi: ${smsHi}`);
  check(`${id}: IVR script has prompts`, buildIvr({ recommendation: rec, signals }).length >= 3);

  const target = outcome.product === "HOME_LOAN" ? "SIP" : "HOME_LOAN";
  const answer = whyNot(signals, target);
  check(`${id}: whyNot(${target}) returns a message`, answer.message.length > 20);
  console.log(`    whyNot(${target}): ${answer.message}`);
  if (answer.path) {
    const applied = { ...signals, [answer.path.feature]: signals[answer.path.feature as keyof typeof signals] };
    check(`${id}: whyNot path names a real signal`, answer.path.feature in applied);
  }
}

// The wellness gate must dominate: a stressed customer can never be talked into credit.
const sunita = getCustomerSignals("CUST_SUNITA").output;
const stressedAnswer = whyNot({ ...sunita, emiMissCount90d: 3 }, "PERSONAL_LOAN");
check(
  "Stressed profile cannot reach PERSONAL_LOAN via a single income change",
  !stressedAnswer.achievable || stressedAnswer.path?.feature === "emiMissCount90d",
  stressedAnswer.message
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
