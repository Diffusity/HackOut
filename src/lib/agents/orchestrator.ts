import { createChatModel, sendWithRetry } from "../gemini";
import { checkConsent } from "../tools/checkConsent";
import { getCustomerSignals } from "../tools/getCustomerSignals";
import { recommendProduct } from "../tools/recommendProduct";
import { detectStressSignals } from "../tools/detectStressSignals";
import { computeTimingSignals } from "../tools/computeTimingSignals";
import { applyWellnessGate } from "../tools/wellnessGate";
import { logAuditEntry } from "../audit";
import { Recommendation, TimingSignals, ToolResult } from "../types";
import { FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { checkOutputGuardrails } from "../guardrails";

const checkConsentDeclaration: FunctionDeclaration = {
  name: "checkConsent",
  description: "Check if the customer has granted consent to access their financial data. MUST be called first.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customerId: { type: SchemaType.STRING, description: "The ID of the customer" },
    },
    required: ["customerId"],
  },
};

const getCustomerSignalsDeclaration: FunctionDeclaration = {
  name: "getCustomerSignals",
  description: "Extract deterministic financial signals from a customer's transaction history.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customerId: { type: SchemaType.STRING, description: "The ID of the customer" },
    },
    required: ["customerId"],
  },
};

const recommendProductDeclaration: FunctionDeclaration = {
  name: "recommendProduct",
  description: "Get a deterministic product recommendation based on the customer's signals.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customerId: { type: SchemaType.STRING, description: "The ID of the customer" },
    },
    required: ["customerId"],
  },
};

const computeTimingSignalsDeclaration: FunctionDeclaration = {
  name: "computeTimingSignals",
  description:
    "Deterministically computes the customer's current life-context timing (salary just credited, EMI due soon, festival window, stable savings momentum, spend pattern shift). Use it to decide WHEN a recommendation is most relevant and to phrase the timing empathetically.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customerId: { type: SchemaType.STRING, description: "The ID of the customer" },
    },
    required: ["customerId"],
  },
};

// Wrapper for the LLM to call
async function recommendProductWrapper(customerId: string): Promise<ToolResult<Recommendation>> {
  const signalsResult = getCustomerSignals(customerId);
  const recResult = recommendProduct(signalsResult.output);
  
  // Apply Wellness Gate
  const stressResult = await detectStressSignals(customerId);
  const gatedRec = applyWellnessGate(stressResult.output, recResult.output);
  
  return {
    ...recResult,
    output: gatedRec,
    reasonTrace: gatedRec.reasonTrace // Updates if suppressed
  };
}

export class AgentOrchestrator {
  private customerId: string;

  constructor(customerId: string) {
    this.customerId = customerId;
  }

  async recommend(): Promise<{ recommendation: ToolResult<Recommendation>; narration: string; timing: ToolResult<TimingSignals> | null }> {
    // Check if API key is missing
    if (!process.env.GEMINI_API_KEY) {
      console.warn("No GEMINI_API_KEY found, running fallback deterministic pipeline");
      return this.runFallbackPipeline();
    }

    const systemInstruction = `
      You are a decision narrator, not a decision maker, for anything financial.
      Your goal is to recommend a product for the customer.
      You MUST ALWAYS call checkConsent first. If consent is denied, stop and say so.
      Then call recommendProduct. 
      Also call computeTimingSignals to learn the customer's current life-context (e.g. salary just credited, EMI due soon, festival window).
      If timing has a trigger, weave it into your explanation naturally (e.g. "now is a good moment because your salary just came in"), using ONLY the timing reason provided.
      If the timing reason says the alert is proactive (not an offer), do NOT push a product — acknowledge the moment supportively.
      When you get the recommendation result, look at the reasonTrace. 
      Your final response must be a plain, empathetic, human-readable explanation of why this product is recommended, using ONLY the facts from the reasonTrace.
      Do not invent reasons. Keep banking terminology simple.
      If the wellnessGateStatus is "suppressed", explicitly mention that you are offering support instead of credit because of financial stress.
    `;

    // systemInstruction must be set at the MODEL level (see src/lib/gemini.ts):
    // passing it to startChat() produces a 400 "Invalid value at 'system_instruction'".
    const chat = createChatModel({
      systemInstruction,
      tools: [
        {
          functionDeclarations: [
            checkConsentDeclaration,
            recommendProductDeclaration,
            computeTimingSignalsDeclaration,
          ],
        },
      ],
    });

    let finalNarration = "";
    let finalRecommendation: ToolResult<Recommendation> | null = null;
    let finalTiming: ToolResult<TimingSignals> | null = null;
    let consentGranted = false;

    try {
      let response = await sendWithRetry(chat, `Recommend a product for customer ${this.customerId}`);
      let calls = response.response.functionCalls();

      while (calls && calls.length > 0) {
        const call = calls[0]; // Handle one at a time for simplicity
        
        let functionResponse: any;

        if (call.name === "checkConsent") {
          const res = checkConsent((call.args as any).customerId as string);
          consentGranted = res.output.consentGranted;
          functionResponse = res.output;
          
          logAuditEntry({
            timestamp: new Date(),
            customerId: this.customerId,
            action: "checkConsent",
            dataAccessed: ["consent_profile"],
            consentVerified: true,
            decision: consentGranted ? "Consent Granted" : "Consent Denied",
            reasonTrace: res.reasonTrace,
          });
        } else if (call.name === "recommendProduct") {
          if (!consentGranted) {
            functionResponse = { error: "Consent not granted. Cannot process recommendation." };
          } else {
            const res = await recommendProductWrapper((call.args as any).customerId as string);
            finalRecommendation = res;
            functionResponse = res.output;
            
            logAuditEntry({
              timestamp: new Date(),
              customerId: this.customerId,
              action: "recommendProduct",
              dataAccessed: ["transactions", "signals"],
              consentVerified: true,
              decision: `Recommended ${res.output.product}`,
              reasonTrace: res.reasonTrace,
            });
          }
        } else if (call.name === "computeTimingSignals") {
          if (!consentGranted) {
            functionResponse = { error: "Consent not granted. Cannot process timing analysis." };
          } else {
            const res = computeTimingSignals((call.args as any).customerId as string);
            functionResponse = res.output;
            finalTiming = res;

            logAuditEntry({
              timestamp: new Date(),
              customerId: this.customerId,
              action: "computeTimingSignals",
              dataAccessed: ["transactions", "signals"],
              consentVerified: true,
              decision: `Timing trigger: ${res.output.trigger ?? "none"} (${res.output.urgency})`,
              reasonTrace: res.reasonTrace,
            });
          }
        } else {
          functionResponse = { error: `Unknown function ${call.name}` };
        }

        response = await sendWithRetry(chat, [{
          functionResponse: {
            name: call.name,
            response: functionResponse,
          }
        }]);
        
        calls = response.response.functionCalls();
      }

      finalNarration = response.response.text();

      if (finalRecommendation) {
        const outputGuard = checkOutputGuardrails(finalNarration, finalRecommendation);
        if (!outputGuard.safe) {
          logAuditEntry({
            timestamp: new Date(),
            customerId: this.customerId,
            action: "guardrail_blocked",
            dataAccessed: [],
            consentVerified: true,
            decision: `Output guardrail flagged narration: ${outputGuard.reason}`,
            reasonTrace: [`Flagged content: ${outputGuard.flaggedContent}`],
          });
          finalNarration = `(Guardrail Alert: Original explanation hidden due to ${outputGuard.reason}). Based on your profile, we recommend ${finalRecommendation.output.product}.`;
        }
      }
    } catch (e: any) {
      console.log("Orchestrator LLM error — degrading to deterministic fallback pipeline:", e?.message ?? e);
      return this.runFallbackPipeline();
    }

    if (!finalRecommendation) {
      return this.runFallbackPipeline();
    }

    finalRecommendation.output.plainLanguageExplanation = finalNarration;
    
    return {
      recommendation: finalRecommendation,
      narration: finalNarration,
      timing: finalTiming,
    };
  }

  private async runFallbackPipeline() {
    const consentRes = checkConsent(this.customerId);
    logAuditEntry({
      timestamp: new Date(),
      customerId: this.customerId,
      action: "checkConsent",
      dataAccessed: ["consent_profile"],
      consentVerified: true,
      decision: consentRes.output.consentGranted ? "Consent Granted" : "Consent Denied",
      reasonTrace: consentRes.reasonTrace,
    });

    if (!consentRes.output.consentGranted) {
      return {
        recommendation: {
          toolName: "fallback",
          output: {
            customerId: this.customerId,
            product: "NONE",
            confidence: 0,
            reasonTrace: ["Consent denied"],
            plainLanguageExplanation: "We cannot access your data without consent.",
            wellnessGateStatus: "passed" as const,
          },
          reasonTrace: ["Consent denied"],
          confidence: 0,
          timestamp: new Date(),
        },
        narration: "We cannot access your data without consent.",
        timing: null,
      };
    }

    const recRes = await recommendProductWrapper(this.customerId);
    const timingRes = computeTimingSignals(this.customerId);

    const timingNarration = timingRes.output.trigger
      ? ` (Timing: ${timingRes.output.reason})`
      : "";

    logAuditEntry({
      timestamp: new Date(),
      customerId: this.customerId,
      action: "computeTimingSignals",
      dataAccessed: ["transactions", "signals"],
      consentVerified: true,
      decision: `Timing trigger: ${timingRes.output.trigger ?? "none"} (${timingRes.output.urgency})`,
      reasonTrace: timingRes.reasonTrace,
    });

    logAuditEntry({
      timestamp: new Date(),
      customerId: this.customerId,
      action: "recommendProduct",
      dataAccessed: ["transactions", "signals"],
      consentVerified: true,
      decision: `Recommended ${recRes.output.product}`,
      reasonTrace: recRes.reasonTrace,
    });

    const narration = `Based on your transaction patterns, we recommend ${recRes.output.product}. ${recRes.reasonTrace.join(", ")}.${timingNarration}`;
    recRes.output.plainLanguageExplanation = narration;

    return {
      recommendation: recRes,
      narration,
      timing: timingRes,
    };
  }
}
