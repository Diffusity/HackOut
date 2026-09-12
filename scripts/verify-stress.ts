import { config } from "dotenv";
config({ path: ".env" }); // Call config BEFORE other imports

import { detectStressSignals } from "../src/lib/tools/detectStressSignals";
import { recommendProduct } from "../src/lib/tools/recommendProduct";
import { applyWellnessGate } from "../src/lib/tools/wellnessGate";
import { getCustomerSignals } from "../src/lib/tools/getCustomerSignals";

async function main() {
  const personas = ["CUST_PRIYA", "CUST_SUNITA"];

  for (const id of personas) {
    console.log(`\n=========================================`);
    console.log(`🛡️ Testing Wellness Gate for ${id}`);
    console.log(`=========================================\n`);
    
    const signals = getCustomerSignals(id);
    const stress = await detectStressSignals(id);
    const baseRec = recommendProduct(signals.output);
    const gatedRec = applyWellnessGate(stress.output, baseRec.output);

    console.log("Wellness Score:", stress.output.wellnessScore);
    console.log("Is At Risk:", stress.output.isAtRisk);
    console.log("Reasons:", stress.output.reasons);
    console.log("Empathetic Message:", stress.output.empatheticMessage);
    
    console.log("\nOriginal Recommendation:", baseRec.output.product);
    console.log("Final Recommendation:", gatedRec.product);
    console.log("Gate Status:", gatedRec.wellnessGateStatus);
  }
}

main().catch(console.error);
