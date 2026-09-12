import { NextRequest, NextResponse } from "next/server";
import { detectStressSignals } from "@/lib/tools/detectStressSignals";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const stressResult = await detectStressSignals(p.id);
    
    return NextResponse.json(stressResult.output);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
