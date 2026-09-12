import { NextRequest, NextResponse } from "next/server";
import { AgentOrchestrator } from "@/lib/agents/orchestrator";
import { getAuditLogs, verifyChain } from "@/lib/audit";
import { initRequest } from "@/lib/requestContext";
import { getRecommendationContext } from "@/lib/tools/getRecommendationContext";
import { explainCounterfactuals } from "@/lib/tools/counterfactuals";
import { computeStressCore } from "@/lib/tools/detectStressSignals";
import { assignSegment } from "@/lib/ml/model";
import { resolveNextBestAction } from "@/lib/nextBestAction";
import { buildSms, buildIvr, Lang } from "@/lib/narration";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * One request returns the whole decision: the recommendation, why it was made,
 * what would change it, what the model thought, and the sealed audit records.
 * Bundling it keeps the dashboard to a single LLM-touching call, which matters
 * on a free tier measured in requests per day.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = initRequest(request);
    const { id } = await params;
    const lang = (request.nextUrl.searchParams.get("lang") as Lang) ?? "en";

    const orchestrator = new AgentOrchestrator(id, ctx.now);
    const result = await orchestrator.recommend();

    const decisionContext = getRecommendationContext(id, ctx.now);
    const recommendation = result.recommendation.output;
    const signals = decisionContext.signals;

    const model = signals ? computeStressCore(signals).model : null;
    const segment = signals ? assignSegment(signals) : null;
    const counterfactuals = signals ? explainCounterfactuals(signals, recommendation.product) : [];

    const nextBestAction = resolveNextBestAction({
      recommendation,
      timing: result.timing?.output ?? null,
      model,
      wellnessScore: decisionContext.wellnessScore,
    });

    return NextResponse.json({
      recommendation,
      timing: result.timing?.output ?? null,
      narrationSource: result.narrationSource,
      counterfactuals,
      model,
      segment,
      nextBestAction,
      channels: {
        sms: buildSms({ recommendation, signals, lang }),
        ivr: buildIvr({ recommendation, signals, lang }),
      },
      auditLogs: getAuditLogs(id),
      chain: verifyChain(),
      asOf: ctx.now?.toISOString() ?? null,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
