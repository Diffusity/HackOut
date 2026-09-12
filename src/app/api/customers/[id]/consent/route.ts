import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, updateCustomerConsent } from "@/lib/data";
import { logAuditEntry } from "@/lib/audit";
import { initRequest } from "@/lib/requestContext";
import { CONSENT_COOKIE, serializeOverrides } from "@/lib/consentStore";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    initRequest(request);
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
    initRequest(request);
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

    const scopes: { key: "transactions" | "spendCategories" | "location"; label: string }[] = [
      { key: "transactions", label: "transactions" },
      { key: "spendCategories", label: "spend categories" },
      { key: "location", label: "location" },
    ];

    for (const scope of scopes) {
      if (oldConsent[scope.key] !== consent[scope.key]) {
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
