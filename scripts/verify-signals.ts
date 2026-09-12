import { getCustomerSignals } from "../src/lib/tools/getCustomerSignals";

const personas = ["CUST_PRIYA", "CUST_RAMESH", "CUST_SUNITA"];

personas.forEach(id => {
  console.log(`\n--- Signals for ${id} ---`);
  try {
    const res = getCustomerSignals(id);
    console.log(JSON.stringify(res.output, null, 2));
    console.log("\nReason Trace:");
    res.reasonTrace.forEach(t => console.log(`  - ${t}`));
  } catch (e: any) {
    console.error(`Error: ${e.message}`);
  }
});
