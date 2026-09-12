import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai';

/**
 * LAZY client creation — DO NOT create the client at module top level.
 * Reasons (both verified live):
 * 1. ESM imports are hoisted, so a top-level `new GoogleGenerativeAI(...)`
 *    in this module runs BEFORE any `dotenv.config()` call in a script/API
 *    has loaded `.env`, permanently baking in an empty/stale key.
 * 2. Never `console.warn` at module top level either: some script runners
 *    (PowerShell NativeCommandError) abort the process on stderr written
 *    during import. Warn lazily only when a model is actually created.
 */
let _genAI: GoogleGenerativeAI | null = null;
function getGenAI(): GoogleGenerativeAI {
  if (!_genAI) {
    if (!process.env.GEMINI_API_KEY) {
      console.warn("GEMINI_API_KEY environment variable is not set. Gemini features will not work.");
    }
    _genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
  }
  return _genAI;
}

/**
 * MODEL PIN (verified live, Sep 2026):
 * - `gemini-2.0-flash` / `gemini-2.5-flash`: RETIRED (404 "no longer available
 *   to new users") for API projects created Sep 2026.
 * - `gemini-3.6-flash` (and 3.7/lates aliases) REJECT the legacy `role: "function"`
 *   turn that @google/generative-ai 0.24.x sends in its function-calling loop
 *   ("Role 'function' is not supported").
 * - `gemini-3.5-flash` is the newest STABLE model that still ACCEPTS role
 *   "function" (verified: 200 on a functionResponse turn), so the SDK 0.24
 *   tool-calling loop works unchanged. Re-visit if we upgrade to @google/genai.
 */
export const CHAT_MODEL = 'gemini-3.5-flash';

/**
 * Transient-error retry for Gemini calls (demo-robustness).
 * Free-tier keys are throttled to ~5 requests/minute/model → 429s are ROUTINE
 * in a multi-call pipeline. Retries with backoff sized for that quota before
 * giving up; callers then degrade gracefully (deterministic fallbacks).
 * NOTE: logs go to stdout (console.log) — stderr output can abort the process
 * under some script runners (PowerShell NativeCommandError quirk).
 */
export async function sendWithRetry(chat: any, message: any, maxAttempts = 3): Promise<any> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await chat.sendMessage(message);
    } catch (e: any) {
      const status = e?.status ?? 0;
      const transient = status === 429 || status === 500 || status === 503;
      if (!transient || attempt === maxAttempts) throw e;
      // Backoff must stay well inside the Vercel function timeout (ADR-022):
      // 15s/30s sleeps got the lambda killed before the retry could land.
      const backoffMs = attempt * 2000; // 2s, 4s
      console.log(`[gemini] transient error ${status} (attempt ${attempt}/${maxAttempts}), retrying in ${backoffMs}ms...`);
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  throw new Error("unreachable");
}

export const geminiFlash = () =>
  getGenAI().getGenerativeModel({ model: CHAT_MODEL });
export const geminiPro = () =>
  getGenAI().getGenerativeModel({ model: 'gemini-pro-latest' });

/**
 * Creates a chat model with the system instruction applied at the MODEL level.
 *
 * IMPORTANT (verified against @google/generative-ai 0.24.x live API):
 * Passing `systemInstruction` to `startChat()` produces a 400 Bad Request
 * ("Invalid value at 'system_instruction'"). It must be set on
 * `getGenerativeModel()` instead. Always use this helper rather than
 * `model.startChat({ systemInstruction })`.
 *
 * Model selection: see the MODEL PIN note on `CHAT_MODEL` above.
 */
export function createChatModel(options: {
  systemInstruction?: string;
  generationConfig?: GenerationConfig;
  tools?: any[];
}) {
  return getGenAI().getGenerativeModel({
    model: CHAT_MODEL,
    ...(options.systemInstruction ? { systemInstruction: options.systemInstruction } : {}),
  }).startChat({
    ...(options.generationConfig ? { generationConfig: options.generationConfig } : {}),
    ...(options.tools ? { tools: options.tools } : {}),
  });
}
