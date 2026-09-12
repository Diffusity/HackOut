import { NextRequest, NextResponse } from "next/server";
import { getCustomerSignals } from "@/lib/tools/getCustomerSignals";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const signals = getCustomerSignals(p.id);
    return NextResponse.json(signals);
  } catch (error: any) {
    if (error.message.includes("not found")) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
