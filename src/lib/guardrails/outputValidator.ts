import { GuardrailResult } from "./types";

const RAW_PII_PATTERNS = [
  /\b\d{4}-\d{4}-\d{4}\b/, // Aadhaar with dashes
  /\b\d{12}\b/, // Aadhaar without dashes
  /\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/, // PAN
  /\b(?:\+91-?|0)?\d{10}\b/, // Indian Phone number
];

export function checkOutputValidator(output: string): GuardrailResult {
  if (output.length > 2000) {
    return {
      safe: false,
      reason: "Output too long",
    };
  }

  for (const pattern of RAW_PII_PATTERNS) {
    if (pattern.test(output)) {
      return {
        safe: false,
        reason: "Raw PII leaked in output",
        flaggedContent: output.match(pattern)?.[0] || "Unknown PII",
      };
    }
  }

  return { safe: true };
}
