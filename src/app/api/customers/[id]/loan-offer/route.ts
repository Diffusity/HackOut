import { NextRequest, NextResponse } from "next/server";
import { initRequest, finaliseRequest } from "@/lib/requestContext";
import { getCustomerById } from "@/lib/data";
import { getCustomerSignals } from "@/lib/tools/getCustomerSignals";
import { computeStressCore } from "@/lib/tools/detectStressSignals";
import { decide } from "@/lib/tools/counterfactuals";
import { checkConsent } from "@/lib/tools/checkConsent";
import { buildKeyFactsStatement, isLendingProduct } from "@/lib/lending/keyFactStatement";
import { saveOffer } from "@/lib/lending/loanStore";
import { logAuditEntry } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Issues a Key Facts Statement (ADR-033).
 *
 * The order of the checks below is the product thesis in miniature: consent,
 * then the wellness gate, then — only if both clear — a priced offer. A
 * customer the gate has flagged cannot reach a loan document at all, no matter
 * what they click. Refusing here rather than in the UI means the refusal
 * survives anyone calling the API directly.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = await initRequest(request);
    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const product: string = body.product ?? "PERSONAL_LOAN";

    const customer = getCustomerById(id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    if (!isLendingProduct(product)) {
      return NextResponse.json(
        { error: `${product} is not a lending product, so it has no Key Facts Statement.` },
        { status: 400 }
      );
    }

    const consent = checkConsent(id);
    if (!consent.output.consentGranted) {
      return NextResponse.json(
        { refused: true, reason: "consent", message: "We cannot assess a loan without access to your transaction history." },
        { status: 200 }
      );
    }

    const signals = getCustomerSignals(id, ctx.now).output;
    const core = computeStressCore(signals);
    const outcome = decide(signals);

    // The gate is the binding constraint, and it is checked on the server.
    if (outcome.suppressed || core.isAtRisk) {
      logAuditEntry({
        timestamp: new Date(),
        customerId: id,
        action: "loan_offer_refused",
        dataAccessed: ["signals"],
        consentVerified: true,
        decision: `Refused to issue a Key Facts Statement for ${product} — wellness gate is closed`,
        reasonTrace: core.reasons,
      });
      await finaliseRequest();

      return NextResponse.json(
        {
          refused: true,
          reason: "wellness_gate",
          message:
            "We are not offering credit right now. Your recent transactions show financial pressure, " +
            "and lending into that would make it worse. Support options are available instead.",
          reasonTrace: core.reasons,
        },
        { status: 200 }
      );
    }

    const kfs = buildKeyFactsStatement({
      customerId: id,
      product,
      signals,
      model: core.model,
      language: customer.preferredLanguage === "hi" ? "hi" : "en",
      now: ctx.now,
    });

    const offer = await saveOffer(kfs, product);

    logAuditEntry({
      timestamp: new Date(),
      customerId: id,
      action: "kfs_issued",
      dataAccessed: ["signals", "income", "obligations"],
      consentVerified: true,
      decision: `Issued KFS ${kfs.proposalNo}: ₹${kfs.part1.sanctionedAmount} at ${kfs.part1.interestRate}% nominal, APR ${kfs.part1.apr}%`,
      reasonTrace: [
        kfs.affordability.explanation,
        `APR ${kfs.part1.apr}% includes ₹${kfs.part1.totalFees} of disclosed charges`,
        `Cooling-off: ${kfs.part2.coolingOffDays} days, exit at principal plus proportionate APR`,
      ],
    });
    await finaliseRequest();

    return NextResponse.json({ refused: false, offer, dataSource: ctx.source });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
