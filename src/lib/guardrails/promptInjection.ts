import { GuardrailResult } from "./types";

const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+(instructions|prompts)/i,
  /system\s*prompt/i,
  /pretend\s+(you\s+are|to\s+be)/i,
  /jailbreak/i,
  /you\s+are\s+now\s+(a|an)/i,
  /forget\s+(all|everything|your)/i,
  /override\s+(your|the)\s+(instructions|rules)/i,
  /act\s+as\s+(a|an|if)/i,
  /new\s+instructions/i,
  /reveal\s+(your|the)\s+(system|internal)/i,
  /<script/i,
  /DROP\s+TABLE/i,
  /SELECT\s+\*\s+FROM/i,
];

export function checkPromptInjection(input: string): GuardrailResult {
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        safe: false,
        reason: "Prompt injection attempt detected",
        flaggedContent: input.match(pattern)?.[0] || "Unknown pattern",
      };
    }
  }

  return { safe: true };
}
