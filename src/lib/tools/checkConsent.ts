import { getCustomerById } from "../data";
import { ToolResult } from "../types";

export function checkConsent(customerId: string): ToolResult<{ consentGranted: boolean; details: Record<string, boolean> }> {
  const customer = getCustomerById(customerId);

  if (!customer) {
    throw new Error(`Customer ${customerId} not found`);
  }

  const reasonTrace: string[] = [];
  const consent = customer.consent;
  const consentGranted = consent.transactions && consent.spendCategories;

  if (consentGranted) {
    reasonTrace.push(`consent=granted (Customer has authorized access to transactions and spend categories)`);
  } else {
    reasonTrace.push(`consent=denied (Customer has restricted access to transactions or spend categories)`);
  }

  return {
    toolName: "checkConsent",
    output: {
      consentGranted,
      details: consent,
    },
    reasonTrace,
    confidence: 1.0,
    timestamp: new Date(),
  };
}
