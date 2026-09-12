import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data";
import { initRequest } from "@/lib/requestContext";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initRequest(request);
    const p = await params;
    const customer = getCustomerById(p.id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    return NextResponse.json(customer);
  } catch {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
