import { config } from "dotenv";
import { AgentOrchestrator } from "../src/lib/agents/orchestrator";
import { getAllAuditLogs } from "../src/lib/audit";

config({ override: true });

async function main() {
  const personas = ["CUST_PRIYA", "CUST_RAMESH", "CUST_SUNITA", "CUST_KAVITA"];

  for (const id of personas) {
    console.log(`\n=========================================`);
    console.log(`🚀 Orchestrating for ${id}`);
    console.log(`=========================================\n`);
    
    const orchestrator = new AgentOrchestrator(id);
    const result = await orchestrator.recommend();
    
    console.log("\n📦 Recommendation Output:");
    console.log(JSON.stringify(result.recommendation.output, null, 2));
    
    console.log("\n🗣️  LLM Narration:");
    console.log(result.narration);
    
    console.log("\n📝 Audit Logs (Most recent first):");
    const logs = getAllAuditLogs().filter(log => log.customerId === id);
    logs.forEach(l => {
      console.log(`  [${l.action}] ${l.decision}`);
      l.reasonTrace.forEach(t => console.log(`    - ${t}`));
    });
  }
}

main().catch(console.error);
