# 🪷 DhanSathi — AI-Powered Hyper-Personalized Banking for Bharat

An ethical, explainable banking-recommendation app built for the HackOut hackathon
(theme: *AI-Powered Hyper-Personalized Banking for Bharat*). Next.js + TypeScript +
Google Gemini, with **deterministic tool pipelines** and an LLM that acts strictly as
a **narrator, not a decision maker**.

Read `SOLUTION_STRATEGY.md` for the product strategy and `ADR.md` for every
architecture decision (with rationale).

## Core pipeline (fully deterministic — no LLM in the decision path)

```
consent check → customer signals → product recommendation → stress detection
→ Wellness Gate (can suppress any sales push) → LLM narration → guardrails → audit log
```

## Features

- **Persona dashboard**: Priya (salaried saver), Ramesh (gig worker), Sunita (financially stressed)
- **Reason traces**: every recommendation ships with a named, inspectable reason trace shown in the UI and audit log
- **Wellness Gate** (ADR-012): hard-coded suppression of sales pushes for at-risk customers — for Sunita you can watch an offer get visibly *suppressed* and replaced with support (`EMI_RESTRUCTURE`)
- **Consent-first privacy** (ADR-014): transaction data is only processed with consent; consent-denied chats refuse to discuss transaction data
- **Vernacular voice chat** (ADR-002/006): Web Speech API with Hinglish/English toggle
- **Grounded chat reasoning** (ADR-021): ask *"Why this product?"* (use the chip in the chat) — the LLM explains using **only** the deterministic reason trace, verified by output guardrails, with a deterministic fallback narration if the LLM is unavailable
- **Prompt-injection shield + output guardrails** (ADR-016), all blocks audit-logged

## Getting started

```bash
npm install
npm run dev
```

Create a `.env` file (never committed):

```
GEMINI_API_KEY=<your Google AI Studio key>
```

> Note: the deterministic pipeline, dashboard, wellness gate, and chat **fallback
> narration all work without a valid key** — a key is only required for LLM
> narration / empathetic-message phrasing.
>
> **Model & quota notes (verified live, Sep 2026):**
> - We pin `gemini-3.5-flash` (see `src/lib/gemini.ts`). Older projects' `gemini-2.x-flash`
>   models are retired for new API keys, and `gemini-3.6+` rejects the legacy
>   `role: "function"` turn that `@google/generative-ai` 0.24.x sends in its
>   function-calling loop.
> - The free tier is ~**5 requests/minute AND ~20 requests/day per model** — a
>   single orchestrator run (multi-turn function calling) can consume the daily
>   budget. All LLM calls retry with backoff (`sendWithRetry`) and degrade
>   gracefully to deterministic fallbacks on quota exhaustion, but **enable
>   billing before the live demo** for real narration headroom.
> - Make sure no stale `GEMINI_API_KEY` is exported in your shell/terminal
>   session — it overrides `.env` (dotenv and Next.js don't override existing
>   env vars).

## Verification scripts

```bash
npx tsx scripts/verify-signals.ts        # signal extraction per persona
npx tsx scripts/verify-stress.ts         # stress scoring + wellness gate (Sunita → suppressed)
npx tsx scripts/verify-chat-context.ts   # chat grounding context per persona (ADR-021)
npx tsx scripts/verify-recommendation.ts # full orchestrator end-to-end (real LLM if key valid)
npx tsc --noEmit                         # typecheck
```

## Dataset

Primary: scripted synthetic dataset in `src/data/` (ADR-007). A supplementary
real-world reference (Kaggle *Bank Customer Segmentation*, 1M+ transactions) and its
mapping plan live in `data/supplementary/README.md`.
