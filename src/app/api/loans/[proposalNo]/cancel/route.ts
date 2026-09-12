import { NextRequest, NextResponse } from "next/server";
import { initRequest, finaliseRequest } from "@/lib/requestContext";
import { getOffer, cancelOffer } from "@/lib/lending/loanStore";
import { computeCoolingOffExit } from "@/lib/lending/keyFactStatement";
import { logAuditEntry } from "@/lib/audit";

export const dynamic = "force-dynamic";

/**
 * The cooling-off exit (Guidelines on Digital Lending, 2 September 2022).
 *
 * A borrower may leave within the cooling-off period by repaying principal plus
 * the proportionate APR for the days held. No penalty, no foreclosure charge.
 * It is one request, and it is not buried behind a call centre.
 */
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
    if (offer.status === "cancelled") {
      return NextResponse.json({ error: "This loan has already been cancelled." }, { status: 409 });
    }
    if (offer.status !== "accepted" || !offer.acceptedAt) {
      return NextResponse.json(
        { error: "Only an accepted loan can be exited under the cooling-off provision." },
        { status: 409 }
      );
    }

    const now = new Date();
    const exit = computeCoolingOffExit(offer.kfs, new Date(offer.acceptedAt), now);

    if (!exit.withinWindow) {
      return NextResponse.json({ refused: true, exit }, { status: 200 });
    }

    const cancelled = await cancelOffer(proposalNo, now, exit.totalPayable);

    logAuditEntry({
      timestamp: now,
      customerId: offer.customerId,
      action: "cooling_off_exit",
      dataAccessed: ["loan_offer"],
      consentVerified: true,
      decision: `Cancelled ${proposalNo} under the cooling-off provision for ₹${exit.totalPayable}`,
      reasonTrace: [
        `Held for ${exit.daysHeld} day(s) of a ${offer.kfs.part2.coolingOffDays}-day window`,
        `Principal ₹${exit.principalOutstanding} plus proportionate APR ₹${exit.proportionateApr}`,
        `Penalty charged: ₹${exit.penalty}`,
      ],
    });
    await finaliseRequest();

    return NextResponse.json({ refused: false, offer: cancelled, exit });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
