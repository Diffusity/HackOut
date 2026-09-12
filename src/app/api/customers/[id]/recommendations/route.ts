import { NextRequest, NextResponse } from "next/server";
import { AgentOrchestrator } from "@/lib/agents/orchestrator";
import { getAuditLogs, verifyChain } from "@/lib/audit";
import { initRequest } from "@/lib/requestContext";
import { getRecommendationContext } from "@/lib/tools/getRecommendationContext";
import { explainCounterfactuals } from "@/lib/tools/counterfactuals";
import { buildSms, buildIvr, Lang } from "@/lib/narration";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = initRequest(request);
    const p = await params;
    const lang = (request.nextUrl.searchParams.get("lang") as Lang) ?? "en";

    const orchestrator = new AgentOrchestrator(p.id, ctx.now);
    const result = await orchestrator.recommend();

    const decisionContext = getRecommendationContext(p.id, ctx.now);
    const recommendation = result.recommendation.output;

    const counterfactuals = decisionContext.signals
      ? explainCounterfactuals(decisionContext.signals, recommendation.product)
      : [];

    const channels = {
      sms: buildSms({ recommendation, signals: decisionContext.signals, lang }),
      ivr: buildIvr({ recommendation, signals: decisionContext.signals, lang }),
    };

    return NextResponse.json({
      recommendation,
      timing: result.timing?.output ?? null,
      counterfactuals,
      channels,
      narrationSource: result.narrationSource,
      auditLogs: getAuditLogs(p.id),
      chain: verifyChain(),
      asOf: ctx.now?.toISOString() ?? null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
