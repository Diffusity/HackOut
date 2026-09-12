import { NextRequest, NextResponse } from "next/server";
import { getCustomerById, updateCustomerConsent } from "@/lib/data";
import { logAuditEntry } from "@/lib/audit";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const p = await params;
    const customer = getCustomerById(p.id);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }
    return NextResponse.json(customer.consent);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
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
    
    // Update data
    const updatedCustomer = updateCustomerConsent(p.id, consent);

    // Audit logs for changes
    if (oldConsent.transactions !== consent.transactions) {
      logAuditEntry({
        timestamp: new Date(),
        customerId: p.id,
        action: "Modify Consent Settings",
        dataAccessed: ["consent_profile"],
        consentVerified: true,
        decision: consent.transactions ? "User granted access to transactions" : "User revoked access to transactions",
        reasonTrace: ["User explicitly toggled setting in Privacy Manager"],
      });
    }

    if (oldConsent.spendCategories !== consent.spendCategories) {
      logAuditEntry({
        timestamp: new Date(),
        customerId: p.id,
        action: "Modify Consent Settings",
        dataAccessed: ["consent_profile"],
        consentVerified: true,
        decision: consent.spendCategories ? "User granted access to spend categories" : "User revoked access to spend categories",
        reasonTrace: ["User explicitly toggled setting in Privacy Manager"],
      });
    }

    if (oldConsent.location !== consent.location) {
      logAuditEntry({
        timestamp: new Date(),
        customerId: p.id,
        action: "Modify Consent Settings",
        dataAccessed: ["consent_profile"],
        consentVerified: true,
        decision: consent.location ? "User granted access to location" : "User revoked access to location",
        reasonTrace: ["User explicitly toggled setting in Privacy Manager"],
      });
    }

    return NextResponse.json(updatedCustomer?.consent);
  } catch (error: any) {
    console.error(error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
