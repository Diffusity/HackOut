import { getRecommendationContext } from "../src/lib/tools/getRecommendationContext";

/**
 * Verifies the deterministic recommendation context that grounds the chat
 * reasoning feature (ADR-021). No LLM calls — runs offline.
 */
function main() {
  const personas = [
    { id: "CUST_PRIYA", expect: { product: "SIP", gate: "passed" } },
    { id: "CUST_RAMESH", expect: { product: "VEHICLE_LOAN", gate: "passed" } },
    // Sunita: natural rec is SIP, but Wellness Gate must suppress it
    { id: "CUST_SUNITA", expect: { product: "EMI_RESTRUCTURE", gate: "suppressed" } },
  ];

  let allPassed = true;

  for (const { id, expect } of personas) {
    console.log(`\n=== ${id} ===`);
    const ctx = getRecommendationContext(id);

    console.log("Consent granted:", ctx.consentGranted);
    console.log("Recommendation:", ctx.recommendation?.product);
    console.log("Gate status:", ctx.gateStatus);
    console.log("Wellness score:", ctx.wellnessScore);
    console.log("Reason trace:");
    ctx.reasonTrace.forEach((r) => console.log(`  - ${r}`));

    const productOk = ctx.recommendation?.product === expect.product;
    const gateOk = ctx.gateStatus === expect.gate;
    const hasTrace = ctx.reasonTrace.length > 0;

    if (!productOk || !gateOk || !hasTrace) {
      allPassed = false;
      console.log(`❌ FAIL — expected product=${expect.product}, gate=${expect.gate}`);
    } else {
      console.log(`✅ PASS`);
    }
  }

  console.log("\n==============================");
  console.log(allPassed ? "✅ ALL CHAT CONTEXT CHECKS PASSED" : "❌ SOME CHECKS FAILED");
  console.log("==============================");
  if (!allPassed) process.exit(1);
}

main();
