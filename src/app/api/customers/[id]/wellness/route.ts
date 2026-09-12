import { NextRequest, NextResponse } from "next/server";
import { detectStressSignals } from "@/lib/tools/detectStressSignals";
import { initRequest } from "@/lib/requestContext";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = initRequest(request);
    const p = await params;
    const stressResult = await detectStressSignals(p.id, ctx.now);
    return NextResponse.json(stressResult.output);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
