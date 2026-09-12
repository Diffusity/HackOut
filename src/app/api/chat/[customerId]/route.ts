import { NextRequest, NextResponse } from "next/server";
import { geminiPro } from "@/lib/gemini";
import { getCustomerById } from "@/lib/data";

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

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json({ 
        reply: "API Key missing. Cannot process chat.",
        language
      });
    }

    const systemInstruction = `
      You are DhanSathi, a friendly, empathetic AI banking assistant for Indian customers.
      You are speaking to ${customer.name}, a Tier ${customer.cityTier} city resident.
      Their preferred language is ${customer.preferredLanguage}.
      
      RULES:
      1. ALWAYS respond in the requested language: ${language === 'hi' ? 'Hindi (written in Roman script / Hinglish)' : 'English'}.
      2. If the user mixes Hindi and English, that is perfectly fine.
      3. Use simple, everyday financial terms. Do not use jargon.
      4. If they ask about loans or complex products, explain the terms (like EMI, Interest Rate) simply.
      5. Keep responses concise and conversational (2-3 short sentences max).
    `;

    // Convert history format to Gemini's format
    const geminiHistory = history.map((msg: any) => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }]
    }));

    const chat = geminiPro.startChat({
      history: geminiHistory,
      systemInstruction,
      generationConfig: {
        temperature: 0.7, // Conversational
      }
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();

    return NextResponse.json({ reply, language });
  } catch (error: any) {
    console.error("Chat API error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
