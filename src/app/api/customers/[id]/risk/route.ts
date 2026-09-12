import { NextRequest, NextResponse } from "next/server";
import { predictRiskScore } from "@/lib/tools/predictRiskScore";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const riskResult = predictRiskScore(p.id);

    return NextResponse.json({
      ...riskResult.output,
      reasonTrace: riskResult.reasonTrace,
      toolName: riskResult.toolName,
    });
  } catch (error: any) {
    if (error.message?.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}