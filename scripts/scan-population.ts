import { getCustomers } from "../src/lib/data";
import { getCustomerSignals } from "../src/lib/tools/getCustomerSignals";
import { computeStressCore } from "../src/lib/tools/detectStressSignals";
import { decide } from "../src/lib/tools/counterfactuals";
import { assignSegment } from "../src/lib/ml/model";

for (const c of getCustomers()) {
  const s = getCustomerSignals(c.customerId).output;
  const core = computeStressCore(s);
  const d = decide(s);
  console.log(
    `${c.customerId.padEnd(16)} ${c.segment.padEnd(13)} T${c.cityTier} inc=${String(s.monthlyIncome).padStart(7)} sav=${(s.savingsRate * 100).toFixed(0).padStart(3)}% emi=${s.emiMissCount90d} rules=${String(core.wellnessScore).padStart(3)} model=${(core.model.probability * 100).toFixed(1).padStart(5)}% esc=${core.model.escalatedByModel ? "YES" : "no "} ${d.product}${d.suppressed ? "*" : ""} [${assignSegment(s).name}]`
  );
}
