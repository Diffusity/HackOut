// Feature 18: PII Redaction Layer

const PII_PATTERNS = [
  { name: "PAN", regex: /[A-Z]{5}[0-9]{4}[A-Z]{1}/g },
  { name: "Aadhaar", regex: /\b\d{4}\s?\d{4}\s?\d{4}\b/g },
  { name: "Phone", regex: /(?:\+91|91)?\s?[6-9]\d{9}\b/g },
  { name: "Email", regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  { name: "Account Number", regex: /\b\d{9,18}\b/g },
  { name: "IFSC", regex: /^[A-Z]{4}0[A-Z0-9]{6}$/g }
];

export interface RedactionResult {
  redactedText: string;
  findings: string[];
}

export function redactPII(text: string): RedactionResult {
  if (!text) return { redactedText: text, findings: [] };

  let redactedText = text;
  const findings = new Set<string>();

  for (const pattern of PII_PATTERNS) {
    redactedText = redactedText.replace(pattern.regex, (match) => {
      findings.add(pattern.name);
      // Keep last 4 digits visible if numeric, else full mask
      const isNumeric = /^\d+$/.test(match.replace(/\s/g, ''));
      if (isNumeric && match.length > 4) {
        return "X".repeat(match.length - 4) + match.slice(-4);
      }
      return "[REDACTED " + pattern.name + "]";
    });
  }

  return {
    redactedText,
    findings: Array.from(findings)
  };
}
