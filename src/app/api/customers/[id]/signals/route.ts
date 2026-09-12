import { NextRequest, NextResponse } from "next/server";
import { getCustomerSignals } from "@/lib/tools/getCustomerSignals";
import { initRequest } from "@/lib/requestContext";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = initRequest(request);
    const p = await params;
    const signals = getCustomerSignals(p.id, ctx.now);
    return NextResponse.json(signals);
  } catch (error: any) {
    if (String(error?.message).includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
