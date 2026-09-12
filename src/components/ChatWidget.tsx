"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useVoice } from "@/hooks/useVoice";
import { speak, stopSpeaking } from "@/lib/speech";
import { Recommendation } from "@/lib/types";
import { MessageSquare, X, Send, Mic, MicOff, Loader2, Info } from "lucide-react";
import { Badge } from "./ui/badge";
import { LANGUAGES, getVoiceLocale } from "@/lib/languageMap";

interface Message {
  role: "user" | "bot";
  content: string;
  /** Set when the reply was a guardrail refusal rather than an answer */
  blocked?: boolean;
  /** Whether the LLM or our deterministic templates wrote this reply */
  source?: "llm" | "deterministic";
}

interface ChatWidgetProps {
  customerId: string;
  customerName?: string;
  /** Grounded recommendation — enables the "why this?" reasoning chip (ADR-021) */
  recommendation?: Recommendation | null;
}

function greeting(name?: string): Message {
  return {
    role: "bot",
    content: name
      ? `Namaste ${name}. Ask me anything about your money, your spending, or why a product was suggested.`
      : "Namaste. Ask me anything about your money, your spending, or why a product was suggested.",
  };
}

export function ChatWidget({ customerId, customerName, recommendation = null }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([greeting(customerName)]);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<"en" | "hi" | "es" | "fr">("en");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    isListening,
    transcript,
    interimTranscript,
    startListening,
    stopListening,
    clearTranscript,
    error: voiceError,
  } = useVoice(getVoiceLocale(lang));

  /**
   * A conversation belongs to one customer. Carrying Priya's thread over to
   * Sunita would leak one person's financial context into another's session —
   * unacceptable in banking, and it also made the assistant answer the previous
   * customer's question. Switching customers starts a clean thread.
   */
  useEffect(() => {
    setMessages([greeting(customerName)]);
    setInput("");
    setIsLoading(false);
    clearTranscript();
    stopSpeaking();
    if (isListening) stopListening();
    // Intentionally keyed on the customer only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, customerName]);

  const handleSend = useCallback(
    async (text: string = input) => {
      if (!text.trim() || isLoading) return;

      const outgoing: Message = { role: "user", content: text };
      const history = messages;
      setMessages([...history, outgoing]);
      setInput("");
      setIsLoading(true);
      stopSpeaking();

      try {
        const res = await fetch(`/api/chat/${customerId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            language: lang,
            // Only real exchanges are replayed; refusals would teach the model
            // to repeat itself, which is exactly the bug we are fixing.
            history: history
              .filter((m) => !m.blocked)
              .map((m) => ({ role: m.role === "user" ? "user" : "model", content: m.content })),
          }),
        });

        const data = await res.json();
        if (data.reply) {
          setMessages((prev) => [
            ...prev,
            { role: "bot", content: data.reply, blocked: data.blocked, source: data.source },
          ]);
          if (!data.blocked) speak(data.reply, lang === "hi" ? "hi-IN" : "en-IN");
        } else {
          setMessages((prev) => [
            ...prev,
            { role: "bot", content: "Sorry, I could not answer that just now." },
          ]);
        }
      } catch (e) {
        console.error(e);
        setMessages((prev) => [
          ...prev,
          { role: "bot", content: "I am having trouble connecting right now." },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [customerId, input, isLoading, lang, messages]
  );

  useEffect(() => {
    if (transcript) setInput(transcript);
  }, [transcript]);

  useEffect(() => {
    if (!isListening && transcript.trim() !== "") {
      handleSend(transcript);
      clearTranscript();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isListening]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  const toggleVoice = () => {
    if (isListening) {
      stopListening();
    } else {
      stopSpeaking();
      setInput("");
      clearTranscript();
      startListening();
    }
  };

  const suggestions = recommendation
    ? [
        {
          label: `Why ${recommendation.product.replace(/_/g, " ").toLowerCase()}?`,
          prompt:
            lang === "hi"
              ? "Ye product mujhe kyu suggest kiya? Simple language mein samjhao."
              : "Why was this product recommended to me? Explain simply.",
        },
        {
          label: "How are my savings?",
          prompt: lang === "hi" ? "Meri bachat kaisi chal rahi hai?" : "How are my savings doing?",
        },
      ]
    : [];

  return (
    <>
      {!isOpen && (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Open DhanSathi chat"
          className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-accent text-accent-fg shadow-lg transition-transform hover:scale-105"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[520px] max-h-[80vh] w-[350px] max-w-[calc(100vw-3rem)] flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-2xl sm:w-[400px]">
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <div>
              <h3 className="text-sm font-semibold">DhanSathi</h3>
              <p className="text-[11px] text-fg-subtle">
                Banking questions only{customerName ? ` · ${customerName}` : ""}
              </p>
            </div>

            <div className="flex items-center gap-1.5">
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as "en" | "hi" | "es" | "fr")}
                className="rounded border border-line bg-surface px-2 py-1 text-[11px] font-semibold text-fg-muted focus:outline-none"
              >
                {Object.entries(LANGUAGES).map(([code, info]) => (
                  <option key={code} value={code}>
                    {info.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  stopSpeaking();
                }}
                className="rounded border border-line px-2 py-1 text-[11px] font-semibold text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`animate-fade-up max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user"
                      ? "bg-accent text-accent-fg"
                      : msg.blocked
                        ? "border border-dashed border-line-strong bg-surface-2 text-fg-muted"
                        : "border border-line bg-surface-2 text-fg"
                  }`}
                >
                  {msg.blocked && (
                    <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em]">
                      <Info className="h-3 w-3" /> Outside banking
                    </div>
                  )}
                  {msg.content}
                  {msg.source === "deterministic" && !msg.blocked && (
                    <div className="mt-1.5">
                      <Badge variant="muted">Grounded fallback</Badge>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isListening && interimTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[85%] rounded-lg bg-surface-2 px-3 py-2 text-sm italic text-fg-muted">
                  {interimTranscript}
                </div>
              </div>
            )}

            {isLoading && (
              <div className="flex justify-start">
                <div className="flex items-center gap-1 rounded-lg border border-line bg-surface-2 px-3 py-2.5">
                  {[0, 0.15, 0.3].map((delay) => (
                    <span
                      key={delay}
                      className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle"
                      style={{ animationDelay: `${delay}s` }}
                    />
                  ))}
                </div>
              </div>
            )}

            {voiceError && <p className="text-center text-xs text-fg-subtle">{voiceError}</p>}

            <div ref={messagesEndRef} />
          </div>

          {suggestions.length > 0 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => handleSend(s.prompt)}
                  disabled={isLoading}
                  className="rounded-full border border-line px-2.5 py-1 text-xs text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-40"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-line p-3">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={toggleVoice}
                aria-label={isListening ? "Stop listening" : "Speak your question"}
                className={`shrink-0 rounded-full border p-2 transition-colors ${
                  isListening
                    ? "border-transparent bg-accent text-accent-fg"
                    : "border-line text-fg-muted hover:bg-surface-2 hover:text-fg"
                }`}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder={isListening ? "Listening…" : "Ask about your money…"}
                className="min-w-0 flex-1 rounded-full border border-line bg-surface-2 px-3.5 py-2 text-sm text-fg placeholder:text-fg-subtle focus:outline-none focus:ring-1 focus:ring-fg"
              />

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                aria-label="Send message"
                className="shrink-0 rounded-full bg-accent p-2 text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
