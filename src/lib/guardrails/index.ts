import { checkPromptInjection } from "./promptInjection";
import { checkOutputValidator } from "./outputValidator";
import { checkFinancialAccuracy } from "./financialGuard";
import { checkTopicScope, ScopeResult } from "./topicScope";
import { GuardrailResult } from "./types";

/**
 * Input guardrails run in order of severity: an injection attempt is an attack
 * and is refused outright; an off-topic question is an honest mistake and gets
 * a helpful redirect. Both are answered WITHOUT calling the LLM.
 */
export function checkInputGuardrails(input: string): ScopeResult {
  const injection = checkPromptInjection(input);
  if (!injection.safe) return injection;
  return checkTopicScope(input);
}

export function checkOutputGuardrails(output: string, toolData?: any): GuardrailResult {
  const validatorResult = checkOutputValidator(output);
  if (!validatorResult.safe) return validatorResult;

  const financialResult = checkFinancialAccuracy(output, toolData);
  if (!financialResult.safe) return financialResult;

  return { safe: true };
}

export * from "./types";
export { checkTopicScope, buildScopeRefusal } from "./topicScope";
export type { ScopeResult } from "./topicScope";
