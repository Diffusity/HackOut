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

  for (const figure of extractedFigures) {
    // Very basic check: does the number (ignoring currency symbols and commas) exist in the tool data?
    const normalizedFigure = figure.replace(/[₹,\s%a-zA-Z]/g, '');
    if (normalizedFigure && !toolDataString.includes(normalizedFigure)) {
      return {
        safe: false,
        reason: "Hallucinated financial figure detected",
        flaggedContent: figure,
      };
    }
  }

  return { safe: true };
}
