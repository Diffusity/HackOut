import { NextRequest, NextResponse } from "next/server";
import { getCustomerById } from "@/lib/data";
import { checkInputGuardrails, checkOutputGuardrails } from "@/lib/guardrails";
import { logAuditEntry } from "@/lib/audit";
import { getRecommendationContext } from "@/lib/tools/getRecommendationContext";
import { createChatModel, sendWithRetry } from "@/lib/gemini";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ customerId: string }> }
) {
  try {
    const p = await params;
    const { customerId } = p;
    const body = await request.json();
    const { message, language = "en", history = [] } = body;

    const customer = getCustomerById(customerId);
    if (!customer) {
      return NextResponse.json({ error: "Customer not found" }, { status: 404 });
    }

    // Layer 1: Prompt Injection Shield (ADR-016) — applied BEFORE any LLM call
    const inputGuard = checkInputGuardrails(message);
    if (!inputGuard.safe) {
      logAuditEntry({
        timestamp: new Date(),
        customerId,
        action: "guardrail_blocked",
        dataAccessed: [],
        consentVerified: false,
        decision: `Blocked prompt injection: ${inputGuard.reason}`,
        reasonTrace: [`Pattern matched: ${inputGuard.flaggedContent}`],
      });
      return NextResponse.json({ 
        reply: "I'm sorry, I can only help with banking and financial queries. Please rephrase your request.",
        language
      });
    }

    // Deterministic grounding context (ADR-021): build the full decision
    // context with ZERO LLM calls so the LLM can only narrate these facts.
    const context = getRecommendationContext(customerId);

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
      return NextResponse.json({ reply: "API Key missing. Cannot process chat.", language });
    }

    // Grounding block — the ONLY financial facts the model may use.
    const groundingBlock = context.consentGranted && context.recommendation
      ? `
RECOMMENDATION CONTEXT (deterministic tool output — treat as the single source of truth):
- Recommended product: ${context.recommendation.product}
- Confidence: ${context.recommendation.confidence}
- Wellness Gate status: ${context.gateStatus}${context.gateStatus === "suppressed" ? " (an original offer was suppressed because the customer is financially stressed — offer support, never push the product)" : ""}
- Financial wellness score: ${context.wellnessScore}/100
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
      1. ALWAYS respond in the requested language: ${language === 'hi' ? 'Hindi (written in Roman script / Hinglish)' : 'English'}.
      2. If the user mixes Hindi and English, that is perfectly fine.
      3. Use simple, everyday financial terms. Do not use jargon.
      4. If they ask about loans or complex products, explain the terms (like EMI, Interest Rate) simply.
      5. Keep responses concise and conversational (2-3 short sentences max).
      6. You are a decision NARRATOR, not a decision maker (ADR-011). When asked WHY a product was recommended (e.g., "why this?", "ye kyu suggest kiya?"), explain using ONLY the facts in the RECOMMENDATION CONTEXT reason trace. Never invent amounts, rates, or reasons that are not in the trace.
      7. If the Wellness Gate suppressed an offer, frame it positively: the system is protecting them and offering support instead.
      8. If asked something not covered by the context, answer generally about banking concepts, but never state specific personalized financial figures that are not in the context.
      9. FIGURE DISCIPLINE (strict — a verifier checks every number you output):
         - Quote numbers EXACTLY as they appear in the reason trace. Never round (55.7% must stay 55.7%, never "56%").
         - Never convert trace percentages into rupee amounts. Do not guess income, salary, or savings figures — none are provided.
         - If a fact isn't in the trace (e.g., exact salary or total savings), say "I can share the exact figures once you enable the relevant data" instead of inventing one.
    `;

    // Convert history format to Gemini's format
    const geminiHistory = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    // systemInstruction is applied at the MODEL level (verified against
    // @google/generative-ai 0.24.x — passing it to startChat() = 400 error).
    const chat = createChatModel({
      systemInstruction,
      generationConfig: {
        temperature: 0.7, // Conversational
      }
    });
    // Replay prior turns, then send the new message
    for (const turn of geminiHistory) {
      await chat.sendMessage(turn.parts[0].text as string).catch(() => {});
    }

    let result;
    try {
      // sendWithRetry absorbs routine free-tier 429s (quota ~5 req/min) before
      // degrading to the deterministic grounded fallback.
      result = await sendWithRetry(chat, message, 2);
    } catch (llmError: any) {
      // LLM unavailable (invalid/missing key, or quota exhausted) — fall back to
      // the deterministic grounded narration so the demo degrades gracefully.
      console.log("Chat LLM error, using grounded fallback:", llmError?.message ?? llmError);
      return NextResponse.json({ reply: buildGroundedFallbackReply(context, language), language });
    }
    let reply = result.response.text();

    // Layer 2+3: Output schema/PII validation + financial accuracy guard (ADR-016).
    // The narration is verified against the deterministic tool output.
    const toolDataForGuard = context.recommendation
      ? { ...context.recommendation, reasonTrace: context.reasonTrace, wellnessScore: context.wellnessScore }
      : null;
    const outputGuard = checkOutputGuardrails(reply, toolDataForGuard);
    if (!outputGuard.safe) {
      // Log the raw blocked reply for demo-day diagnostics.
      console.log(`[guardrail] blocked chat reply (${outputGuard.reason}) — flagged: ${outputGuard.flaggedContent ?? "n/a"} — raw: ${reply}`);
      logAuditEntry({
        timestamp: new Date(),
        customerId,
        action: "guardrail_blocked",
        dataAccessed: [],
        consentVerified: context.consentGranted,
        decision: `Output guardrail flagged chat reply: ${outputGuard.reason}`,
        reasonTrace: [`Flagged content: ${outputGuard.flaggedContent ?? "n/a"}`],
      });
      // Replace with a grounded deterministic reply — the demo never hallucinates.
      reply = buildGroundedFallbackReply(context, language);
    }

    return NextResponse.json({ reply, language });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/**
 * Deterministic fallback narration (LLM-as-narrator safety net): if the LLM is
 * unavailable or its output is blocked by guardrails, we still answer the
 * "why was this recommended?" question from the reason trace — verbatim facts.
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
  const topReasons = context.recommendation.reasonTrace
    .filter((t) => !t.startsWith("[WELLNESS GATE SUPPRESSION]"))
    .slice(0, 3)
    .join("; ");
  const gateNote = context.gateStatus === "suppressed"
    ? " Note: an earlier offer was suppressed by our Wellness Gate because we detected financial stress — we're offering support instead."
    : "";
  return `We recommended ${context.recommendation.product.replace(/_/g, " ").toLowerCase()} because: ${topReasons}.${gateNote}`;
}
