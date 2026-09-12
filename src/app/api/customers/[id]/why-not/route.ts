import { NextRequest, NextResponse } from "next/server";
import { getCustomerSignals } from "@/lib/tools/getCustomerSignals";
import { whyNot } from "@/lib/tools/counterfactuals";
import { checkConsent } from "@/lib/tools/checkConsent";
import { logAuditEntry } from "@/lib/audit";
import { initRequest } from "@/lib/requestContext";

export const dynamic = "force-dynamic";

/**
 * The adverse-action endpoint: "why was I NOT offered X?" — answered by
 * searching the real decision pipeline rather than by asking a model to guess.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ctx = initRequest(request);
    const { id } = await params;
    const product = request.nextUrl.searchParams.get("product");

    if (!product) {
      return NextResponse.json({ error: "product query parameter is required" }, { status: 400 });
    }

    const consent = checkConsent(id);
    if (!consent.output.consentGranted) {
      return NextResponse.json(
        { achievable: false, path: null, message: "We cannot explain this without consent to read your transactions." },
        { status: 200 }
      );
    }

    const signals = getCustomerSignals(id, ctx.now).output;
    const answer = whyNot(signals, product);

    logAuditEntry({
      timestamp: new Date(),
      customerId: id,
      action: "adverse_action_explanation",
      dataAccessed: ["signals"],
      consentVerified: true,
      decision: `Explained why ${product} was not offered`,
      reasonTrace: [answer.message],
    });

    return NextResponse.json(answer);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
