import { computeTimingSignals } from "../src/lib/tools/computeTimingSignals";
import { getCustomers } from "../src/lib/data";

const personas = ["CUST_PRIYA", "CUST_RAMESH", "CUST_SUNITA"];

personas.forEach(id => {
  console.log(`\n--- Timing signals for ${id} ---`);
  try {
    const res = computeTimingSignals(id);
    console.log(JSON.stringify(res.output, null, 2));
    console.log("\nReason Trace:");
    res.reasonTrace.forEach(t => console.log(`  - ${t}`));
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
  }
});

// Consent-denied path: find (or confirm absence of) a customer without transaction consent
const noConsent = getCustomers().filter(c => !c.consent.transactions);
if (noConsent.length > 0) {
  const id = noConsent[0].customerId;
  console.log(`\n--- Timing signals for ${id} (consent denied) ---`);
  const res = computeTimingSignals(id);
  console.log(JSON.stringify(res.output, null, 2));
  if (res.output.trigger === null && res.reasonTrace.some(t => t.includes("consent=denied"))) {
    console.log("\nConsent gate OK: timing blocked for consent-denied customer");
  } else {
    console.error("\nCONSENT GATE FAILED");
    process.exit(1);
  }
} else {
  console.log("\n(no consent-denied customer in fixture data — consent path covered by unit tests)");
}

console.log("\nVERIFY-TIMING DONE");
