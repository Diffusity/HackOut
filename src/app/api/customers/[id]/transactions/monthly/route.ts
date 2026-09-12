import { NextRequest, NextResponse } from "next/server";
import { getTransactionsForCustomer } from "@/lib/data";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const txns = getTransactionsForCustomer(p.id);

    if (txns.length === 0) {
      return NextResponse.json([]);
    }

    // Sort chronologically
    txns.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    const monthlyData = new Map<string, { month: string; credits: number; debits: number }>();

    txns.forEach((t) => {
      const date = new Date(t.timestamp);
      // Format: "Apr '26"
      const monthStr = date.toLocaleString('default', { month: 'short' }) + " '" + date.getFullYear().toString().substr(-2);
      
      if (!monthlyData.has(monthStr)) {
        monthlyData.set(monthStr, { month: monthStr, credits: 0, debits: 0 });
      }
      
      const current = monthlyData.get(monthStr)!;
      if (t.type === "credit") {
        current.credits += t.amount;
      } else {
        current.debits += t.amount;
      }
    });

    return NextResponse.json(Array.from(monthlyData.values()));
  } catch (error: any) {
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
