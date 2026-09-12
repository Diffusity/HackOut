import { getCustomerById } from "../data";
import { ToolResult } from "../types";

export function checkConsent(customerId: string): ToolResult<{ 
  consentGranted: boolean; 
  details: Record<string, boolean>;
  allowedCategories: string[];
  deniedCategories: string[];
}> {
  const customer = getCustomerById(customerId);

  if (!customer) {
    throw new Error(`Customer ${customerId} not found`);
  }

  const reasonTrace: string[] = [];
  const consent = customer.consent;
  
  const allowedCategories: string[] = [];
  const deniedCategories: string[] = [];

  if (consent.transactions) allowedCategories.push("transactions");
  else deniedCategories.push("transactions");

  if (consent.location) allowedCategories.push("location");
  else deniedCategories.push("location");

  if (consent.spendCategories) allowedCategories.push("spendCategories");
  else deniedCategories.push("spendCategories");

  // For the AI to even work, we need at least transactions
  const consentGranted = consent.transactions;

  if (consentGranted) {
    reasonTrace.push(`consent=granted (Customer has authorized access to: ${allowedCategories.join(", ")})`);
    if (deniedCategories.length > 0) {
      reasonTrace.push(`Note: Access to ${deniedCategories.join(", ")} is restricted by the user.`);
    }
  } else {
    reasonTrace.push(`consent=denied (Customer has restricted access to core transaction data)`);
  }

  return {
    toolName: "checkConsent",
    output: {
      consentGranted,
      details: consent,
      allowedCategories,
      deniedCategories,
    },
    reasonTrace,
    confidence: 1.0,
    timestamp: new Date(),
  };
}
