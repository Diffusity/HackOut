import { NextRequest, NextResponse } from "next/server";
import { initRequest } from "@/lib/requestContext";
import { getOffer } from "@/lib/lending/loanStore";
import { computeCoolingOffExit } from "@/lib/lending/keyFactStatement";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ proposalNo: string }> }
) {
  try {
    await initRequest(request);
    const { proposalNo } = await params;

    const offer = await getOffer(proposalNo);
    if (!offer) {
      return NextResponse.json({ error: "Proposal not found" }, { status: 404 });
    }

    // If the loan is live, say what walking away costs right now — not what it
    // cost at disbursal. The figure a borrower needs is today's figure.
    const exit =
      offer.status === "accepted" && offer.acceptedAt
        ? computeCoolingOffExit(offer.kfs, new Date(offer.acceptedAt), new Date())
        : null;

    return NextResponse.json({ offer, exit });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
