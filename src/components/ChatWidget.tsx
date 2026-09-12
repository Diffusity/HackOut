import { useState, useRef, useEffect } from "react";
import { useVoice } from "@/hooks/useVoice";
import { speak, stopSpeaking } from "@/lib/speech";
import { Recommendation } from "@/lib/types";
import { MessageCircle, X, Send, Mic, MicOff, Sparkles, Loader2, HelpCircle } from "lucide-react";

interface Message {
  role: "user" | "bot";
  content: string;
}

interface ChatWidgetProps {
  customerId: string;
  /** Grounded recommendation — enables the "Why this?" reasoning chip (ADR-021) */
  recommendation?: Recommendation | null;
}

export function ChatWidget({ customerId, recommendation = null }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "bot", content: "Namaste! I am DhanSathi. How can I help you today?" }
  ]);
  const [input, setInput] = useState("");
  const [lang, setLang] = useState<"en" | "hi">("hi"); // Default to Hindi for demo
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Voice hook uses hi-IN or en-IN based on selected lang
  const { isListening, transcript, interimTranscript, startListening, stopListening, clearTranscript, error: voiceError } = useVoice(lang === "hi" ? "hi-IN" : "en-IN");

  // Sync voice transcript to input
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Handle voice stopping and auto-sending
  useEffect(() => {
    // If it was listening and just stopped, and we have a transcript, send it
    if (!isListening && transcript.trim() !== "") {
      handleSend(transcript);
      clearTranscript();
    }
  }, [isListening]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, interimTranscript]);

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    const newMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);
    stopSpeaking(); // Stop any ongoing speech

    try {
      const res = await fetch(`/api/chat/${customerId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          language: lang,
          history: messages // Send history for multi-turn
        })
      });

      const data = await res.json();
      if (data.reply) {
        setMessages([...newMessages, { role: "bot", content: data.reply }]);
        // Speak the reply automatically
        speak(data.reply, lang === "hi" ? "hi-IN" : "en-IN");
      }
    } catch (e) {
      console.error(e);
      setMessages([...newMessages, { role: "bot", content: "Sorry, I am having trouble connecting right now." }]);
    } finally {
      setIsLoading(false);
    }
  };

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

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full shadow-lg shadow-indigo-500/30 flex items-center justify-center transition-transform hover:scale-110 z-50"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      )}

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 w-[350px] sm:w-[400px] h-[500px] max-h-[80vh] bg-gray-950 border border-white/10 rounded-2xl shadow-2xl flex flex-col z-50 overflow-hidden backdrop-blur-xl">
          
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gray-900/50">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                <Sparkles className="w-4 h-4 text-indigo-400" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-100">DhanSathi Chat</h3>
                <p className="text-xs text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Online
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {/* Language Toggle */}
              <button 
                onClick={() => setLang(lang === "en" ? "hi" : "en")}
                className="text-xs font-semibold bg-gray-800 hover:bg-gray-700 px-2 py-1 rounded text-gray-300 transition-colors"
              >
                {lang === "en" ? "ENG" : "हिंदी"}
              </button>
              
              <button onClick={() => { setIsOpen(false); stopSpeaking(); }} className="text-gray-400 hover:text-white transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div 
                  className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm shadow-sm ${
                    msg.role === "user" 
                      ? "bg-indigo-600 text-white rounded-tr-sm" 
                      : "bg-gray-800 text-gray-200 border border-white/5 rounded-tl-sm"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            
            {/* Interim voice transcript preview */}
            {isListening && interimTranscript && (
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl px-4 py-2 text-sm bg-indigo-600/50 text-white/70 rounded-tr-sm italic">
                  {interimTranscript}...
                </div>
              </div>
            )}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-800 border border-white/5 rounded-2xl rounded-tl-sm px-4 py-2 flex items-center gap-1">
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            )}
            
            {voiceError && (
               <div className="text-xs text-rose-400 text-center">{voiceError}</div>
            )}
            
            <div ref={messagesEndRef} />
          </div>

          {/* Grounded reasoning quick-actions (ADR-021) */}
          {recommendation && (
            <div className="px-3 pb-1 flex flex-wrap gap-2">
              <button
                onClick={() => handleSend(lang === "hi" ? "Ye product mujhe kyu suggest kiya? Simple language mein samjhao." : "Why was this product recommended to me? Explain simply.")}
                disabled={isLoading}
                className="flex items-center gap-1.5 text-xs bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full px-3 py-1.5 transition-colors disabled:opacity-50"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Why {recommendation.product.replace(/_/g, " ").toLowerCase()}?
              </button>
            </div>
          )}

          {/* Input Area */}
          <div className="p-3 border-t border-white/10 bg-gray-900/80">
            <div className="flex items-center gap-2">
              <button 
                onClick={toggleVoice}
                className={`p-2 rounded-full transition-all flex-shrink-0 ${
                  isListening 
                    ? "bg-rose-500 text-white animate-pulse shadow-[0_0_15px_rgba(244,63,94,0.5)]" 
                    : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700"
                }`}
              >
                {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder={isListening ? "Listening..." : "Type a message..."}
                className="flex-1 bg-gray-800 border border-white/5 rounded-full px-4 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-500"
              />
              
              <button 
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-2 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:hover:bg-indigo-600 transition-colors flex-shrink-0"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
          
        </div>
      )}
    </>
  );
}
