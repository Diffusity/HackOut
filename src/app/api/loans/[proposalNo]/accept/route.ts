import { NextRequest, NextResponse } from "next/server";
import { initRequest, finaliseRequest } from "@/lib/requestContext";
import { getOffer, acceptOffer } from "@/lib/lending/loanStore";
import { logAuditEntry } from "@/lib/audit";

export const dynamic = "force-dynamic";

export async function POST(
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
    if (offer.status !== "issued") {
      return NextResponse.json(
        { error: `This proposal is already ${offer.status}.` },
        { status: 409 }
      );
    }

    const now = new Date();

    // Terms that have expired cannot be accepted. The validity window is a
    // promise about price, and honouring a stale one is not generosity — it
    // means the KFS the customer read was not the document that bound us.
    if (now > new Date(offer.kfsValidUntil)) {
      return NextResponse.json(
        {
          error: "This Key Facts Statement has expired. Request a fresh one so the terms you accept are the terms you read.",
          expired: true,
        },
        { status: 410 }
      );
    }

    const coolingOffEnds = new Date(now);
    coolingOffEnds.setDate(coolingOffEnds.getDate() + offer.kfs.part2.coolingOffDays);

    const accepted = await acceptOffer(proposalNo, now, coolingOffEnds);

    logAuditEntry({
      timestamp: now,
      customerId: offer.customerId,
      action: "loan_accepted",
      dataAccessed: ["loan_offer"],
      consentVerified: true,
      decision: `Accepted ${proposalNo}: ₹${offer.principal} at APR ${offer.apr}%`,
      reasonTrace: [
        `Cooling-off period runs until ${coolingOffEnds.toISOString()}`,
        `Exit during that window costs principal plus proportionate APR, with no penalty`,
      ],
    });
    await finaliseRequest();

    return NextResponse.json({ offer: accepted });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
