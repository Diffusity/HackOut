import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data";
import { checkInputGuardrails, checkOutputGuardrails, buildScopeRefusal } from "@/lib/guardrails";
import { logAuditEntry } from "@/lib/audit";
import { getRecommendationContext } from "@/lib/tools/getRecommendationContext";
import { createChatModel, sendWithRetry } from "@/lib/gemini";
import { buildNarration } from "@/lib/narration";
import { initRequest, finaliseRequest } from "@/lib/requestContext";
import { assignSegment } from "@/lib/ml/model";
import { computeStressCore } from "@/lib/tools/detectStressSignals";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const ctx = await initRequest(request);
    const { customerId } = await params;
    const body = await request.json();
    const { message, language = "en", history = [] } = body;

    const customer = getCustomerById(customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // ---- Input guardrails (ADR-016 + ADR-028) — BEFORE any LLM call ----
    const inputGuard = checkInputGuardrails(message);
    if (!inputGuard.safe) {
      const isInjection = inputGuard.reason === "Prompt injection attempt detected";
      logAuditEntry({
        timestamp: new Date(),
        customerId,
        action: isInjection ? "guardrail_blocked" : "out_of_scope_refusal",
        dataAccessed: [],
        consentVerified: false,
        decision: isInjection
          ? `Blocked prompt injection: ${inputGuard.reason}`
          : `Refused out-of-scope question about ${inputGuard.detectedTopic}`,
        reasonTrace: [`Flagged content: ${inputGuard.flaggedContent ?? "n/a"}`],
      });

      const reply = isInjection
        ? language === "hi"
          ? "Yeh request main process nahi kar sakta. Kripya apne banking sawaal dobara likhein."
          : "I can't process that request. Please rephrase your banking question."
        : buildScopeRefusal(inputGuard, language);

      // `blocked` lets the UI mark this turn visibly rather than passing a
      // refusal off as a normal answer.
      await finaliseRequest();
      return NextResponse.json({ reply, language, blocked: true, blockReason: inputGuard.reason });
    }

    // Deterministic grounding context (ADR-021): the full decision context with
    // ZERO LLM calls, so the LLM can only narrate facts we computed.
    const context = getRecommendationContext(customerId, ctx.now);
    const segment = context.signals ? assignSegment(context.signals) : null;
    const modelVerdict = context.signals ? computeStressCore(context.signals).model : null;

    logAuditEntry({
      timestamp: new Date(),
      customerId,
      action: "chat_turn",
      dataAccessed: context.consentGranted ? ["signals", "recommendation_reason_trace"] : ["consent_profile"],
      consentVerified: context.consentGranted,
      decision: `Chat turn (${language}): ${message.slice(0, 80)}`,
      reasonTrace: context.reasonTrace.slice(0, 5),
    });

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({
        reply: buildGroundedFallbackReply(context, language),
        language,
        source: "deterministic",
      });
    }

    const groundingBlock = context.consentGranted && context.recommendation
      ? `
RECOMMENDATION CONTEXT (deterministic tool output — treat as the single source of truth):
- Recommended product: ${context.recommendation.product}
- Confidence: ${context.recommendation.confidence}
- Wellness Gate status: ${context.gateStatus}${context.gateStatus === "suppressed" ? " (an original offer was suppressed because the customer is financially stressed — offer support, never push the product)" : ""}
- Financial wellness score: ${context.wellnessScore}/100
${segment ? `- Behavioural segment: ${segment.name} (their savings rate sits at the ${segment.savingsPercentile}th percentile of comparable customers)` : ""}
${modelVerdict ? `- Model distress probability: ${Math.round(modelVerdict.probability * 100)}% (threshold ${Math.round(modelVerdict.threshold * 100)}%)${modelVerdict.escalatedByModel ? " — the model escalated this customer even though the rules cleared them" : ""}` : ""}
- Full reason trace (explains exactly WHY this product was chosen):
${context.reasonTrace.map((t, i) => `  ${i + 1}. ${t}`).join("\n")}
`
      : context.consentGranted
        ? ""
        : `\nIMPORTANT: This customer has NOT granted consent to analyze their transactions. Never discuss or infer anything from their transaction data, signals, or recommendations. Politely explain they can enable access in Privacy Controls.\n`;

    const systemInstruction = `
      You are DhanSathi, a friendly, empathetic AI banking assistant for Indian customers.
      You are speaking to ${customer.name}, a Tier ${customer.cityTier} city resident.
      Their preferred language is ${customer.preferredLanguage}.
      ${groundingBlock}
      RULES:
      1. ALWAYS respond in the requested language: ${language === "hi" ? "Hindi (written in Roman script / Hinglish)" : "English"}.
      2. If the user mixes Hindi and English, that is perfectly fine.
      3. Use simple, everyday financial terms. Do not use jargon.
      4. If they ask about loans or complex products, explain the terms (like EMI, Interest Rate) simply.
      5. Keep responses concise and conversational (2-3 short sentences max).
      6. You are a decision NARRATOR, not a decision maker (ADR-011). When asked WHY a product was recommended, explain using ONLY the facts in the RECOMMENDATION CONTEXT reason trace. Never invent amounts, rates, or reasons that are not in the trace.
      7. If the Wellness Gate suppressed an offer, frame it positively: the system is protecting them and offering support instead.
      8. You only discuss banking and personal finance. If the question drifts elsewhere, say so plainly and steer back — never answer it.
      9. FIGURE DISCIPLINE (strict — a verifier checks every number you output):
         - Quote numbers EXACTLY as they appear in the reason trace. Never round (55.7% must stay 55.7%, never "56%").
         - Never convert trace percentages into rupee amounts. Do not guess income, salary, or savings figures.
         - If a fact isn't in the trace, say "I can share the exact figures once you enable the relevant data" instead of inventing one.
    `;

    // History is handed to startChat, not replayed turn by turn: replaying cost
    // one API call per prior message and exhausted the free-tier quota in a
    // three-message conversation.
    const geminiHistory = (history as { role: string; content: string }[])
      .filter((m) => typeof m?.content === "string" && m.content.length > 0)
      .slice(-8)
      .map((msg) => ({
        role: (msg.role === "user" ? "user" : "model") as "user" | "model",
        parts: [{ text: msg.content }],
      }));

    // Gemini requires history to begin with a user turn.
    while (geminiHistory.length > 0 && geminiHistory[0].role !== "user") geminiHistory.shift();

    const chat = createChatModel({
      systemInstruction,
      history: geminiHistory,
      generationConfig: { temperature: 0.7 },
    });

    let result;
    try {
      result = await sendWithRetry(chat, message, 2);
    } catch (llmError: any) {
      console.log("Chat LLM error, using grounded fallback:", llmError?.message ?? llmError);
      return NextResponse.json({
        reply: buildGroundedFallbackReply(context, language),
        language,
        source: "deterministic",
      });
    }

    let reply = result.response.text();
    let source: "llm" | "deterministic" = "llm";

    // ---- Output guardrails (ADR-016): verify the narration against tool output ----
    const toolDataForGuard = context.recommendation
      ? { ...context.recommendation, reasonTrace: context.reasonTrace, wellnessScore: context.wellnessScore }
      : null;
    const outputGuard = checkOutputGuardrails(reply, toolDataForGuard);
    if (!outputGuard.safe) {
      console.log(`[guardrail] blocked chat reply (${outputGuard.reason}) — raw: ${reply}`);
      logAuditEntry({
        timestamp: new Date(),
        customerId,
        action: "guardrail_blocked",
        dataAccessed: [],
        consentVerified: context.consentGranted,
        decision: `Output guardrail flagged chat reply: ${outputGuard.reason}`,
        reasonTrace: [`Flagged content: ${outputGuard.flaggedContent ?? "n/a"}`],
      });
      reply = buildGroundedFallbackReply(context, language);
      source = "deterministic";
    }

    await finaliseRequest();
    return NextResponse.json({ reply, language, source });
  } catch (error) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Deterministic fallback narration (LLM-as-narrator safety net): if the LLM is
 * unavailable or its output is blocked, we still answer from the reason trace
 * with verbatim facts rather than silence.
 */
function buildGroundedFallbackReply(
  context: ReturnType<typeof getRecommendationContext>,
  language: string
): string {
  if (!context.consentGranted) {
    return language === "hi"
      ? "Main aapke transaction data ko bina consent ke access nahi kar sakta. Kripya Privacy Controls mein access enable karein."
      : "I can't analyze your transactions without consent. Please enable access in Privacy Controls.";
  }
  if (!context.recommendation) {
    return language === "hi"
      ? "Maaf kijiye, mujhe abhi aapki profile ka vivaran nahi mil raha."
      : "Sorry, I don't have your profile details right now.";
  }
  // The same grounded template the dashboard uses (ADR-024) — readable prose
  // rather than a joined reason trace, so a dead quota is not visibly worse.
  return buildNarration({
    recommendation: context.recommendation,
    signals: context.signals,
    wellnessScore: context.wellnessScore,
    lang: language === "hi" ? "hi" : "en",
  });
}
