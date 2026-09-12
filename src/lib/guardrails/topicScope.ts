import { GuardrailResult } from "./types";

/**
 * Topic scope guard (ADR-028).
 *
 * A banking assistant that answers questions about cricket or writes code is a
 * liability, not a feature. This runs BEFORE any LLM call: an out-of-scope
 * message is refused deterministically, so it costs no tokens, cannot be
 * steered off-domain, and produces a refusal that actually names the topic
 * instead of silently reusing the previous answer.
 *
 * Written to accept Hinglish and Devanagari as first-class, not as an
 * afterthought — most of our users will not type in English.
 */

/** In-scope vocabulary: banking, money, and personal finance (en + hi + hinglish). */
const FINANCIAL_TERMS = [
  // English
  "account", "balance", "bank", "banking", "loan", "emi", "instalment", "installment",
  "credit", "debit", "card", "interest", "rate", "deposit", "fd", "rd", "sip", "mutual fund",
  "invest", "investment", "savings", "save", "saving", "spend", "spending", "expense",
  "income", "salary", "money", "rupee", "rupees", "cash", "upi", "transfer", "transaction",
  "insurance", "policy", "premium", "pension", "tax", "refund", "budget", "debt", "repay",
  "default", "cibil", "credit score", "overdraft", "mortgage", "wellness", "recommend",
  "suggestion", "offer", "product", "consent", "privacy", "data", "fraud", "scam",
  "statement", "kyc", "nominee", "atm", "cheque", "neft", "imps", "rtgs", "gold loan",
  "why this", "why did", "explain", "afford", "eligible", "eligibility", "apply",
  // Hinglish / romanised Hindi
  "paisa", "paise", "rupaye", "rupya", "bachat", "kharch", "kharcha", "kharche", "loan lena",
  "byaj", "nivesh", "bima", "khata", "jama", "karz", "udhaar", "udhar", "kist", "kisht",
  "tankhwah", "tankhah", "vetan", "aamdani", "kamai", "bank wala", "paise ka", "kyu suggest",
  "kyun", "kyu", "batao", "bachao", "madad",
  // Devanagari
  "पैसा", "पैसे", "बचत", "खर्च", "ब्याज", "निवेश", "बीमा", "खाता", "कर्ज", "किस्त",
  "तनख्वाह", "आमदनी", "कमाई", "ऋण", "जमा", "बैंक", "सलाह", "सुझाव",
];

/** Conversational glue we allow through so the assistant is not robotic. */
const SMALL_TALK = [
  /^\s*(hi|hello|hey|namaste|namaskar|salaam|yo)\b/i,
  /^\s*(thanks|thank you|dhanyavaad|shukriya|ok|okay|got it|theek hai|accha|thik hai)\b/i,
  /\b(who are you|what can you do|what do you do|help me|kya kar sakte|tum kaun|aap kaun)\b/i,
  /^\s*(bye|goodbye|alvida)\b/i,
  /^\s*नमस्ते/,
  /^\s*धन्यवाद/,
];

/**
 * Topics we refuse outright even if a money word appears somewhere in the
 * sentence ("how much money do I need to buy bitcoin" is still not our job).
 */
const HARD_OUT_OF_SCOPE = [
  { pattern: /\b(weather|temperature|rain|forecast|mausam|बारिश|मौसम)\b/i, topic: "the weather" },
  { pattern: /\b(cricket|football|match|ipl|score|world cup|खेल|मैच)\b/i, topic: "sports" },
  { pattern: /\b(movie|film|song|music|netflix|actor|actress|फिल्म|गाना)\b/i, topic: "entertainment" },
  { pattern: /\b(recipe|cook|food|biryani|restaurant|खाना|रेसिपी)\b/i, topic: "food and recipes" },
  { pattern: /\b(election|politics|minister|party|vote|चुनाव|राजनीति)\b/i, topic: "politics" },
  { pattern: /\b(medicine|doctor|disease|symptom|covid|fever|दवा|बीमारी)\b/i, topic: "medical advice" },
  { pattern: /\b(write|generate|debug)\s+(me\s+)?(a\s+)?(code|program|script|python|java|sql|essay|poem|story)\b/i, topic: "writing code or essays" },
  { pattern: /\b(homework|assignment|exam|physics|chemistry|history lesson)\b/i, topic: "schoolwork" },
  { pattern: /\b(crypto|bitcoin|ethereum|dogecoin|nft)\b/i, topic: "cryptocurrency, which we are not licensed to advise on" },
  { pattern: /\b(horoscope|astrology|rashi|kundli|राशि)\b/i, topic: "astrology" },
  { pattern: /\b(joke|riddle|chutkula|मज़ाक)\b/i, topic: "jokes" },
];

export interface ScopeResult extends GuardrailResult {
  /** What the customer asked about, so the refusal can name it */
  detectedTopic?: string;
}

export function checkTopicScope(input: string): ScopeResult {
  const text = input.toLowerCase().trim();

  if (text.length === 0) {
    return { safe: false, reason: "empty_message", detectedTopic: "nothing" };
  }

  for (const { pattern, topic } of HARD_OUT_OF_SCOPE) {
    if (pattern.test(text)) {
      return { safe: false, reason: "out_of_scope", detectedTopic: topic, flaggedContent: input.slice(0, 120) };
    }
  }

  if (FINANCIAL_TERMS.some((term) => text.includes(term))) return { safe: true };
  if (SMALL_TALK.some((pattern) => pattern.test(input))) return { safe: true };

  // A bare "why?" or "and then?" is a follow-up on the conversation we are
  // already having, so it stays in scope.
  if (/^\s*(why|how|what|kaise|kyun|kyu|aur|and)\b[\s?]*$/i.test(text)) return { safe: true };

  return { safe: false, reason: "out_of_scope", detectedTopic: "that", flaggedContent: input.slice(0, 120) };
}

/** The refusal itself — specific, polite, and it offers a way forward. */
export function buildScopeRefusal(result: ScopeResult, language: string): string {
  const topic = result.detectedTopic ?? "that";

  if (result.reason === "empty_message") {
    return language === "hi"
      ? "Aapne kuch likha nahi. Apne paise, kharche ya kisi bank product ke baare mein poochhiye."
      : "I didn't catch that. Ask me anything about your money, spending, or a bank product.";
  }

  if (language === "hi") {
    return (
      `Main sirf banking aur aapke paison se jude sawaalon mein madad kar sakta hoon, ` +
      `isliye ${topic === "that" ? "is sawaal" : topic} ka jawab main nahi de paunga. ` +
      `Aap mujhse poochh sakte hain: "ye product kyu suggest kiya?", "meri bachat kaisi hai?", ya "meri EMI kab hai?"`
    );
  }

  return (
    `I can only help with banking and your personal finances, so I can't answer questions about ${topic}. ` +
    `Try asking me: "why was this product recommended?", "how are my savings doing?", or "when is my next EMI due?"`
  );
}
