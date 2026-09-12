import { NextRequest, NextResponse } from "next/server";
import { AgentOrchestrator } from "@/lib/agents/orchestrator";
import { getAllAuditLogs } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const orchestrator = new AgentOrchestrator(p.id);
    const result = await orchestrator.recommend();
    
    return NextResponse.json({
      recommendation: result.recommendation.output,
      rawToolResult: result.recommendation,
      auditLogs: getAllAuditLogs().filter(log => log.customerId === p.id)
    });
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
