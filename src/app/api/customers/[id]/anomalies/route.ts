import { NextResponse } from "next/server";
import { detectAnomalies } from "@/lib/tools/detectAnomalies";
import { currentSnapshot, loadSnapshot } from "@/lib/db/repository";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await loadSnapshot();
  const customer = currentSnapshot().customers.find((c) => c.customerId === id);
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const res = detectAnomalies(id);
  return NextResponse.json(res.output);
}
