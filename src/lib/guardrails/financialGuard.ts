import { GuardrailResult } from "./types";

const FINANCIAL_FIGURE_PATTERNS = [
  /₹\s?\d+(,\d+)*(\.\d+)?/gi, // Amounts (e.g., ₹10,000)
  /\d+(\.\d+)?%/g, // Percentages (e.g., 10.5%)
  /\d+\s+(EMI|EMIs|months|years)\b/gi, // EMI counts or durations
];

export function checkFinancialAccuracy(output: string, toolData?: any): GuardrailResult {
  // If no tool data was provided, we can't verify facts, but we shouldn't necessarily block it
  // unless we're strictly enforcing that all financial talk comes from tools.
  // For the hackathon, we'll extract numbers and see if they exist in the reasonTrace or tool output.
  
  const extractedFigures: string[] = [];
  for (const pattern of FINANCIAL_FIGURE_PATTERNS) {
    const matches = output.match(pattern);
    if (matches) {
      extractedFigures.push(...matches);
    }
  }

  if (extractedFigures.length === 0) {
    return { safe: true };
  }

  if (!toolData) {
    // We found financial figures but have no tool data to verify against
    return {
      safe: false,
      reason: "Financial figures detected without supporting tool data",
      flaggedContent: extractedFigures.join(", "),
    };
  }

  const toolDataString = JSON.stringify(toolData).toLowerCase();
  // Normalize BOTH sides symmetrically: the extracted figure has ₹/commas/spaces
  // stripped, so the tool data must be stripped the same way — otherwise a
  // grounded figure like ₹1,50,386 (normalized to 150386) never matches the
  // trace text "₹1,50,386" and gets falsely flagged as hallucinated
  // (verified live: the "Why this product?" chat was being blocked for
  // quoting the reason trace verbatim). Digit-grouping commas are collapsed
  // into the number; other ₹/\s occurrences become '|' boundaries so numbers
  // from different fields can't accidentally merge into a false match.
  const normalizedToolData = toolDataString
    .replace(/(\d),(?=\d)/g, '$1') // Indian digit grouping: 1,50,386 → 150386
    .replace(/[₹\s]/g, '|');

  for (const figure of extractedFigures) {
    // Very basic check: does the number (ignoring currency symbols and commas) exist in the tool data?
    const normalizedFigure = figure.replace(/[₹,\s%a-zA-Z]/g, '');
    if (normalizedFigure && !normalizedToolData.includes(normalizedFigure)) {
      return {
        safe: false,
        reason: "Hallucinated financial figure detected",
        flaggedContent: figure,
      };
    }
  }

  return { safe: true };
}
