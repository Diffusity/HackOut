import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, updateCustomerConsent } from "@/lib/data";
import { logAuditEntry } from "@/lib/audit";
import { initRequest, finaliseRequest } from "@/lib/requestContext";
import { recordConsentChange } from "@/lib/db/repository";
import { CONSENT_COOKIE, serializeOverrides } from "@/lib/consentStore";

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
    return NextResponse.json(customer.consent);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await initRequest(request);
    const p = await params;
    const body = await request.json();
    const { consent } = body;

    if (!consent) {
      return NextResponse.json({ error: "Consent payload missing" }, { status: 400 });
    }

    const customer = getCustomerById(p.id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    const oldConsent = { ...customer.consent };
    const updatedCustomer = updateCustomerConsent(p.id, consent);

    const scopes: {
      key: "transactions" | "spendCategories" | "location";
      label: string;
      purpose: string;
    }[] = [
      { key: "transactions", label: "transactions", purpose: "Work out income, spending and savings patterns" },
      { key: "spendCategories", label: "spend categories", purpose: "Distinguish an EMI from an everyday debit" },
      { key: "location", label: "location", purpose: "Match festival timing and local branch support" },
    ];

    for (const scope of scopes) {
      if (oldConsent[scope.key] !== consent[scope.key]) {
        // Append to the durable consent ledger. DPDP asks what a customer had
        // consented to at a given moment, which a mutable column cannot answer.
        await recordConsentChange(
          p.id,
          scope.key,
          consent[scope.key],
          scope.purpose
        );
        logAuditEntry({
          timestamp: new Date(),
          customerId: p.id,
          action: "Modify Consent Settings",
          dataAccessed: ["consent_profile"],
          consentVerified: true,
          decision: consent[scope.key]
            ? `User granted access to ${scope.label}`
            : `User revoked access to ${scope.label}`,
          reasonTrace: ["User explicitly toggled setting in Privacy Manager"],
        });
      }
    }

    // Persist the change client-side: serverless instances share no memory, so
    // the cookie is the authoritative record of any consent change (ADR-022).
    await finaliseRequest();

    const response = NextResponse.json(updatedCustomer?.consent);
    response.cookies.set(CONSENT_COOKIE, serializeOverrides(), {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
