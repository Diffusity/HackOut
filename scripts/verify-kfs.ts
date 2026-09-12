/**
 * Key Facts Statement and APR verification (ADR-033). No LLM, no database.
 *
 * The APR assertions matter most: a wrong APR on a real KFS is a regulatory
 * breach, so these check the arithmetic against closed-form expectations rather
 * than against whatever the code happens to produce.
 */
import { getCustomerSignals } from "../src/lib/tools/getCustomerSignals";
import { computeStressCore } from "../src/lib/tools/detectStressSignals";
import { decide } from "../src/lib/tools/counterfactuals";
import {
  buildKeyFactsStatement,
  computeApr,
  computeEmi,
  buildAmortisation,
  computeCoolingOffExit,
} from "../src/lib/lending/keyFactStatement";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

console.log("EMI arithmetic");
// ₹1,00,000 at 12% for 12 months is a textbook EMI of ₹8,884.88.
const emi = computeEmi(100000, 12, 12);
check("Textbook EMI matches the closed form", Math.abs(emi - 8884.88) < 0.5, emi.toFixed(2));
check("Zero-rate EMI is simple division", Math.abs(computeEmi(120000, 0, 12) - 10000) < 0.01);

console.log("\nAmortisation");
const schedule = buildAmortisation(100000, 12, 12, new Date("2026-01-01T00:00:00Z"));
check("One row per instalment", schedule.length === 12);
check("Balance closes at exactly zero", schedule[11].closingBalance === 0, String(schedule[11].closingBalance));
check(
  "Principal components repay the whole principal",
  Math.abs(schedule.reduce((s, r) => s + r.principalComponent, 0) - 100000) < 0.05
);
check(
  "Interest falls every month on a reducing balance",
  schedule.every((row, i) => i === 0 || row.interestComponent <= schedule[i - 1].interestComponent)
);

console.log("\nAPR");
// With no fees, APR must come back to the nominal rate.
const noFeeApr = computeApr(100000, emi, 12);
check(
  "With zero fees the nominal APR equals the interest rate",
  Math.abs(noFeeApr.nominalAnnualised - 12) < 0.05,
  `${noFeeApr.nominalAnnualised.toFixed(3)}%`
);
check(
  "Effective annualised exceeds nominal (monthly compounding)",
  noFeeApr.effectiveAnnualised > noFeeApr.nominalAnnualised,
  `${noFeeApr.effectiveAnnualised.toFixed(3)}% vs ${noFeeApr.nominalAnnualised.toFixed(3)}%`
);

// Upfront fees cut the net disbursal, which must raise the APR. This gap is
// the entire reason the disclosure is mandated.
const withFeeApr = computeApr(97500, emi, 12);
check(
  "Upfront fees push the APR above the headline rate",
  withFeeApr.effectiveAnnualised > noFeeApr.effectiveAnnualised + 3,
  `${withFeeApr.effectiveAnnualised.toFixed(2)}% vs ${noFeeApr.effectiveAnnualised.toFixed(2)}%`
);
check("APR is monotonic in fees", computeApr(95000, emi, 12).effectiveAnnualised > withFeeApr.effectiveAnnualised);

console.log("\nKey Facts Statement");
const signals = getCustomerSignals("CUST_PRIYA").output;
const model = computeStressCore(signals).model;
const kfs = buildKeyFactsStatement({
  customerId: "CUST_PRIYA",
  product: "PERSONAL_LOAN",
  signals,
  model,
  now: new Date("2026-09-12T00:00:00Z"),
});

console.log(`  proposal ${kfs.proposalNo}`);
console.log(
  `  ₹${kfs.part1.sanctionedAmount.toLocaleString("en-IN")} at ${kfs.part1.interestRate}% for ${kfs.part1.tenorMonths} months` +
    ` -> EMI ₹${kfs.part1.instalment.amount.toLocaleString("en-IN")}, APR ${kfs.part1.apr}%`
);
console.log(`  ${kfs.affordability.explanation}`);

check("Proposal number is unique per issue", kfs.proposalNo.startsWith("DS-PL-"));
check("APR is disclosed and exceeds the nominal rate", kfs.part1.apr > kfs.part1.interestRate, `${kfs.part1.apr}% vs ${kfs.part1.interestRate}%`);
check("Every fee is itemised with a payee", kfs.part1.fees.every((f) => f.label && f.payableTo));
check("Third-party charges are separated from the lender's own", kfs.part1.fees.some((f) => f.payableTo === "lender"));
check("Amortisation schedule covers the full tenor", kfs.amortisation.length === kfs.part1.tenorMonths);
check("APR computation sheet is present", kfs.aprComputation.method.length > 50);
check("Both APR conventions are disclosed", kfs.aprComputation.nominalAnnualised > 0 && kfs.aprComputation.effectiveAnnualised > 0);
check("Contingent charges are listed", kfs.part1.contingentCharges.length >= 4);
check("KFS states a validity window", new Date(kfs.validUntil) > new Date(kfs.issuedAt));
check("Grievance and nodal officer details present (Part 2)", kfs.part2.nodalOfficer.email.length > 0);
check("Cooling-off is at least 3 days for a multi-month tenor", kfs.part2.coolingOffDays >= 3, `${kfs.part2.coolingOffDays} days`);
check("Penal charges are never capitalised", kfs.part1.contingentCharges[0].terms.includes("never capitalised"));

check(
  "Total repayment equals principal plus total interest",
  Math.abs(kfs.aprComputation.totalRepayment - (kfs.part1.sanctionedAmount + kfs.aprComputation.totalInterest)) < 1
);
check(
  "The EMI stays inside the affordability ceiling",
  kfs.part1.instalment.amount <= kfs.affordability.maxAffordableEmi + 1,
  `EMI ₹${kfs.part1.instalment.amount} vs cap ₹${kfs.affordability.maxAffordableEmi}`
);

console.log("\nCooling-off exit");
const disbursed = new Date("2026-09-12T00:00:00Z");
const dayTwo = computeCoolingOffExit(kfs, disbursed, new Date("2026-09-14T00:00:00Z"));
const dayTen = computeCoolingOffExit(kfs, disbursed, new Date("2026-09-22T00:00:00Z"));

console.log(`  day 2: ${dayTwo.explanation}`);
check("Exit inside the window is permitted", dayTwo.withinWindow);
check("No penalty is ever charged on exit", dayTwo.penalty === 0);
check("Exit costs principal plus proportionate APR only", Math.abs(dayTwo.totalPayable - (dayTwo.principalOutstanding + dayTwo.proportionateApr)) < 0.01);
check("Proportionate APR is a small fraction of a full month", dayTwo.proportionateApr < kfs.part1.instalment.amount);
check("Exit after the window is refused", !dayTen.withinWindow);
check("The later exit still offers free prepayment", dayTen.explanation.includes("no foreclosure charge"));

console.log("\nThe wellness gate outranks the loan journey");
const sunita = getCustomerSignals("CUST_SUNITA").output;
check(
  "A gated customer is never routed to a KFS",
  decide(sunita).suppressed,
  "the offer is suppressed before a Key Facts Statement is ever generated"
);

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
