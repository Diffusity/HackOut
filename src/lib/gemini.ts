import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  console.warn("GEMINI_API_KEY environment variable is not set. Gemini features will not work.");
}

const genAI = new GoogleGenerativeAI(apiKey || "");

export const geminiFlash = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
export const geminiPro = genAI.getGenerativeModel({ model: 'gemini-2.0-pro' });
