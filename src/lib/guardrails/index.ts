import { checkPromptInjection } from "./promptInjection";
import { checkOutputValidator } from "./outputValidator";
import { checkFinancialAccuracy } from "./financialGuard";
import { GuardrailResult } from "./types";

export function checkInputGuardrails(input: string): GuardrailResult {
  return checkPromptInjection(input);
}

export function checkOutputGuardrails(output: string, toolData?: any): GuardrailResult {
  const validatorResult = checkOutputValidator(output);
  if (!validatorResult.safe) return validatorResult;

  const financialResult = checkFinancialAccuracy(output, toolData);
  if (!financialResult.safe) return financialResult;

  return { safe: true };
}

export * from "./types";
