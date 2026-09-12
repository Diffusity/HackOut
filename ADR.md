# 📐 Architecture Decision Records (ADR) — DhanSathi

> **Document purpose**: Each ADR below records a decision made for this hackathon build (theme: AI-Powered Hyper-Personalized Banking for Bharat), the alternatives considered, and the consequences accepted. Written so a coding agent or new teammate can understand *why* the code looks the way it does, not just what it does. Companion to `SOLUTION_STRATEGY.md` — read that file first for full product/feature context.

> **Constraints assumed throughout**: ~36-hour hackathon, 3 engineers, Next.js (TypeScript) full-stack, Google Gemini API.

**Status legend**: **Accepted** (build this way) · **Proposed** (default, revisit only if time allows) · **Rejected-alternative** (documented for context, not built).

---

## ADR Index

| ADR # | Title | Status | Primary Judging Criterion Served |
|-------|-------|--------|----------------------------------|
| 001 | [Multi-Agent Architecture with Deterministic Tool-Calling](#adr-001-multi-agent-architecture-with-deterministic-tool-calling) | ✅ Accepted | Innovation & feasibility |
| 002 | [Google Gemini as Primary LLM](#adr-002-google-gemini-as-primary-llm) | ✅ Accepted | Innovation & feasibility |
| 003 | [Next.js as Full-Stack Framework](#adr-003-nextjs-as-full-stack-framework) | ✅ Accepted | Execution speed (indirect) |
| 004 | [Custom Agent Orchestrator, Not LangChain/CrewAI](#adr-004-custom-agent-orchestrator-not-langchaincrewai) | ✅ Accepted | Innovation & feasibility, explainability |
| 005 | [Modular Monolith, Not Microservices](#adr-005-modular-monolith-not-microservices) | ✅ Accepted | Scalability (narrative) |
| 006 | [Web Speech API for Voice Interface](#adr-006-web-speech-api-for-voice-interface) | ✅ Accepted | Usability for vernacular-first users |
| 007 | [Synthetic Bharat-Specific Banking Dataset](#adr-007-synthetic-bharat-specific-banking-dataset) | ✅ Accepted | Enables all demos; scalability narrative |
| 008 | [SQLite/JSON for Data, Not Postgres/Supabase](#adr-008-sqlitejson-for-data-not-postgressupabase) | ✅ Accepted | Execution speed, scalability (narrative) |
| 009 | [Prompt Engineering, Not Fine-Tuning](#adr-009-prompt-engineering-not-fine-tuning) | ✅ Accepted | Execution speed (indirect) |
| 010 | [Vercel for Deployment](#adr-010-vercel-for-deployment) | ✅ Accepted | Execution speed (indirect) |
| 011 | [LLM as Narrator, Not Decision-Maker — Deterministic Tools for Financial Logic](#adr-011-llm-as-narrator-not-decision-maker--deterministic-tools-for-financial-logic) | ✅ Accepted | Explainability, compliance readiness |
| 012 | [Hard-Coded Wellness Gate, Not LLM Discretion](#adr-012-hard-coded-wellness-gate-not-llm-discretion) | ✅ Accepted | Genuine benefit / anti-predatory (highest leverage) |
| 013 | [Structured Reason Traces as Data Contract from Day 1](#adr-013-structured-reason-traces-as-data-contract-from-day-1) | ✅ Accepted | Explainability (foundational) |
| 014 | [First-Class Consent Ledger, Not an Afterthought Slide](#adr-014-first-class-consent-ledger-not-an-afterthought-slide) | ✅ Accepted | Compliance readiness |
| 015 | [Rule-Based Stress Detection, Not Trained ML Model](#adr-015-rule-based-stress-detection-not-trained-ml-model) | ✅ Accepted | Explainability, honest/defensible design |
| 021 | [Grounded Chat Reasoning over Reason Traces (Explain-This-Recommendation Chat)](#adr-021-grounded-chat-reasoning-over-reason-traces-explain-this-recommendation-chat) | ✅ Accepted | Explainability, genuine benefit |

---

## ADR-001: Multi-Agent Architecture with Deterministic Tool-Calling

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

The problem statement requires three distinct AI capabilities: transaction analysis & product recommendation, vernacular conversational interface, and financial stress detection & empathetic intervention. We need to decide the overall system architecture.

### Decision

**Adopt an agentic architecture** where a Gemini LLM orchestrator calls specialized tools via function-calling. The critical distinction: the tools themselves are mostly **deterministic TypeScript code** (not more LLM calls). The LLM orchestrates (decides what to call) and narrates (phrases the output). Only the vernacular conversation tool is LLM-backed end-to-end.

The 5 tools:
1. `getCustomerSignals()` — deterministic signal extraction
2. `recommendProduct()` — deterministic scoring + LLM narrative
3. `detectStressSignals()` — deterministic rule + statistical engine
4. `checkConsent()` — deterministic policy check
5. `vernacularReply()` — LLM-backed (the only one)

Plus a hard-coded **Wellness Gate** sitting between tool output and customer response.

### Rationale

1. **Separation of Concerns**: Each tool has a single, well-defined responsibility. Focused inputs produce more reliable outputs than a "do everything" prompt.
2. **Innovation Signal**: Real tool-calling agentic design is genuinely more sophisticated than most hackathon teams implement. It's not "prompt-chaining theatre."
3. **Explainability**: Because financial determinations are made by deterministic code, every decision can be traced to specific signals and thresholds — not LLM intuition.
4. **Composability**: Tools can be combined in different workflows. The chatbot can invoke the recommender, which checks consent first, which checks the wellness gate last.
5. **Team Parallelism**: 3 team members can work on different tools simultaneously.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Single large LLM prompt doing everything, no tools** | Reads as a "wrapper," fails explainability, cannot be audited or defended under judge questioning |
| **Fully deterministic pipeline, no LLM at all** | Underuses the team's strongest skill area, weakens "innovation" score, produces stiff language for empathetic interventions |
| **Microservices with separate LLM instances** | Overkill for 36-hour hackathon. Same benefits achievable with in-process tool functions |
| **6 separate LLM-powered agents (our original design)** | Every agent being LLM-powered means financial decisions are non-deterministic and non-auditable. Judges with compliance backgrounds will catch this |

### Consequences

- (+) Every determination is independently testable via a raw API call — also your demo-risk mitigation
- (+) Directly answers "explainability" with an architecture-level argument, not just a UI feature
- (+) Clean code structure that judges can understand from a diagram
- (–) Slightly more upfront design work than either extreme; mitigated by keeping tool schemas simple

**Judging impact**: Primary driver of "innovation & technical feasibility" and "explainability."

---

## ADR-002: Google Gemini as Primary LLM

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

The AI backbone needs to support multilingual generation (Hindi, Tamil, Telugu, etc.), function calling (for tool-use architecture), contextual reasoning, and fast response times.

### Decision

**Use Google Gemini 2.0** as the primary LLM:
- **Gemini 2.0 Flash** for chatbot interactions (low latency, cost-effective)
- **Gemini 2.0 Pro** for complex orchestration tasks (if needed, otherwise Flash throughout)

### Rationale

1. **Team Access**: Already available. No signup/billing setup during hackathon.
2. **Multilingual Excellence**: Strong native support for Indian languages — critical for vernacular chatbot.
3. **Function Calling**: Maps perfectly to our tool-use architecture.
4. **Generous Free Tier**: Covers hackathon usage.
5. **Speed**: Flash is one of the fastest commercial LLMs — important for live demo responsiveness.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **OpenAI GPT-4o** | Team doesn't have API access. Additional setup time. More expensive |
| **Anthropic Claude** | Team doesn't have API access. Less mature function calling |
| **Open-source (Llama 3)** | Requires GPU infrastructure. Self-hosting is risky in hackathon |

### Consequences

- (+) Zero setup time for AI infrastructure
- (+) Native Indian language support without translation layers
- (+) Function calling enables structured tool outputs
- (–) Vendor lock-in (acceptable for hackathon)

**Judging impact**: Enables "usability for vernacular-first users" and fast, responsive demo.

---

## ADR-003: Next.js as Full-Stack Framework

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

We need a framework supporting premium frontend, API routes for backend logic, and easy deployment. Team is strong in TypeScript.

### Decision

**Use Next.js 14+ with App Router** as the full-stack framework.

### Rationale

1. **Full-Stack in One Repo**: API routes handle backend alongside React frontend.
2. **Team Strength**: Full-stack development is the team's core strength.
3. **Vercel Integration**: One-click deployment to our deployment target.
4. **TypeScript Throughout**: Type safety for tool interfaces and data contracts.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Python (FastAPI) + React** | Language mismatch. Team stronger in TypeScript. Two separate deployments |
| **Vite + Express** | Two separate projects. More setup time. No SSR |
| **Plain React (CRA)** | No backend. No SSR. Needs separate API server |

### Consequences

- (+) Single codebase, fast initial page loads (impressive in demo)
- (+) API routes for agent orchestration endpoints
- (–) Node.js runtime — not ideal for CPU-intensive tasks (not relevant — we offload to Gemini API)

**Judging impact**: Indirect — maximizes time available for judge-visible features.

### Implementation Notes

Initialize with: `npx -y create-next-app@latest ./ --typescript --tailwind --eslint --app --src-dir --import-alias "@/*"` (non-interactive).

---

## ADR-004: Custom Agent Orchestrator, Not LangChain/CrewAI

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

We need an orchestration layer to coordinate our tools. Options range from building a custom orchestrator to using LangChain, CrewAI, or similar frameworks.

### Decision

**Build a custom lightweight agent orchestrator in TypeScript.** The orchestrator follows the **"LLM as narrator"** constraint: it uses Gemini's function-calling to decide which tools to invoke, but the tools contain the actual financial logic.

### Rationale

1. **Simplicity**: Our workflow is a straightforward pipeline. LangChain/CrewAI add thousands of lines of abstraction for features we won't use.
2. **Debuggability**: When something breaks at 3 AM, we need to understand every line. A 200-line orchestrator is transparent.
3. **Demo Transparency**: Judges can see clean, readable code — not a framework's internals.
4. **LLM-as-Narrator Enforcement**: A custom orchestrator lets us enforce the rule that the LLM never makes financial decisions — it only calls deterministic tools and narrates their output. This is harder to guarantee with a framework that abstracts away the control flow.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **LangChain.js** | Heavy abstraction, complex dependency tree, debugging painful. Judges may view as "just using a framework" |
| **CrewAI** | Python-only. Would require separate Python backend |
| **LlamaIndex** | Focused on RAG — our use case is more agentic than retrieval-based |

### Consequences

- (+) Full control over tool lifecycle, error handling, retry logic
- (+) Clean, readable codebase judges can inspect
- (+) Can enforce "LLM never makes financial decisions" at the orchestrator level
- (–) We implement our own retry/fallback logic (simple — try/catch with backoff)

**Judging impact**: Directly supports "innovation & feasibility" — shows real engineering.

### Implementation Notes

```typescript
// Core interfaces
interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>; // JSON Schema for function calling
  execute(args: Record<string, any>): Promise<ToolResult>;
}

interface ToolResult {
  toolName: string;
  output: any;               // Tool-specific structured output
  reasonTrace: string[];     // Human-readable reasoning chain
  confidence?: number;
  timestamp: Date;
}

// Orchestrator — uses Gemini function-calling
class AgentOrchestrator {
  private tools: Map<string, Tool>;
  private gemini: GeminiClient;

  async processRequest(customerId: string, request: string): Promise<Response> {
    // 1. Build context
    // 2. Send to Gemini with tool schemas
    // 3. Gemini decides which tool(s) to call
    // 4. Execute tool calls (deterministic)
    // 5. Wellness Gate check (if credit product recommended)
    // 6. Gemini narrates the result in plain language
    // 7. Log audit trail
  }
}
```

Place tool implementations in `src/lib/tools/` with one file per tool. Orchestrator in `src/lib/agents/orchestrator.ts`.

---

## ADR-005: Modular Monolith, Not Microservices

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

"Scalability across a bank's existing digital infrastructure" is a judging criterion, but the team has 3 people and 36 hours.

### Decision

**Build one Next.js application with clearly separated modules** (signals, recommendation, stress-detection, consent, chat) that mirror eventual service boundaries, but deploy as a single process.

### Rationale

1. **All engineering time goes into judge-visible features.** Microservices infrastructure (multiple deployments, service discovery, inter-service auth) is invisible to judges.
2. **The module boundaries chosen now are exactly the seams you'd cut along to extract services later** — state this explicitly in the pitch as the scalability story.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Real microservices** | Operational overhead would consume most of 36 hours on infrastructure no judge will see |
| **No internal modularity** | Would make codebase harder to demo/explain and wouldn't support scalability narrative |

### Consequences

- (+) All build time stays on judge-visible features
- (+) Clear seams for future service extraction
- (–) Judges asking "does this scale?" need a narrative answer — prepare the one-paragraph answer in advance

**Judging impact**: Supports "scalability" via credible design narrative without spending build time on infrastructure.

### Production Migration Path (documented, not built)

In production, the modular monolith would split into:
- **Event-driven ingestion**: Kafka-style stream from core banking → signal extraction service
- **Feature store**: For computed signals, updated in near-real-time
- **Recommendation service**: Stateless, horizontally scalable
- **Conversation service**: Stateless, backed by Gemini API
- **Audit/compliance service**: Write-heavy, append-only log
- **PostgreSQL** for transactional data, replacing SQLite/JSON

---

## ADR-006: Web Speech API for Voice Interface

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

The vernacular chatbot needs voice input/output to serve non-tech-savvy users who may not be comfortable typing.

### Decision

**Use browser-native Web Speech API** for both speech recognition (STT) and speech synthesis (TTS).

### Rationale

1. **Zero Cost**: No API charges, no third-party service.
2. **Zero Dependencies**: Built into Chrome/Edge.
3. **Indian Language Support**: Chrome supports Hindi (`hi-IN`), Tamil (`ta-IN`), Telugu (`te-IN`), and more.
4. **Live Demo Friendly**: Client-side, no network latency. Real-time voice interaction.
5. **Implementation Speed**: ~50 lines of code. Under 2 hours.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Google Cloud Speech-to-Text** | Costs money, requires API key, adds latency |
| **Whisper (OpenAI)** | Requires server-side processing, heavy model |
| **AssemblyAI / Deepgram** | Third-party dependency, cost, setup time |

### Consequences

- (+) Zero cost, zero setup, impressive in live demo
- (–) Browser-dependent (Chrome/Edge — acceptable for demo)
- (–) Accuracy varies by language (have text fallback ready)

**Judging impact**: High visual impact — voice demo is a showstopper. Directly supports "usability for vernacular-first users."

### Implementation Notes

```typescript
// Speech Recognition (STT)
const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
recognition.lang = 'hi-IN';
recognition.continuous = false;
recognition.interimResults = true;

// Speech Synthesis (TTS)
const speak = (text: string, lang = 'hi-IN') => {
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = lang;
  utterance.rate = 0.9;
  window.speechSynthesis.speak(utterance);
};
```

Create `src/lib/speech.ts` utility and `src/hooks/useVoice.ts` React hook.

---

## ADR-007: Synthetic Bharat-Specific Banking Dataset

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

No real bank data is available or compliant to use. Public financial datasets (e.g., generic credit-card fraud datasets) don't reflect Indian UPI/salary/EMI behavior patterns.

### Decision

**Generate synthetic banking data using a TypeScript script** producing ~15-20 customers with realistic Indian transaction patterns, including 3 named demo personas (Priya, Ramesh, Sunita).

### Rationale

1. **Full Control**: Embed specific patterns our tools are designed to detect. Guarantees flawless demo.
2. **Bharat-Specific**: Indian merchants, UPI IDs, salary patterns, festival bumps. The "designed for Bharat" narrative is in the data itself.
3. **Honest**: Clearly-labeled synthetic data is expected in hackathon context. State this openly.
4. **Fast**: Script generates all data in minutes. No cleaning or privacy concerns.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Kaggle fraud/transaction datasets** | Wrong locale (US/EU), missing Indian patterns (UPI, vernacular), would weaken "Bharat" narrative |
| **Scraping from real bank sources** | No compliant source exists in hackathon timeframe |
| **Fully random generation** | No embedded patterns → tools can't demonstrate intelligence |

### Consequences

- (+) Reliable demoability across all challenge points
- (+) Each persona tells a story judges will remember
- (–) Judges may ask about real-data calibration — answer: "Thresholds are illustrative; in production they'd be calibrated against the bank's historical data"

**Judging impact**: Enables reliable demo across all three challenge points; supports "scalability" by keeping data layer swappable.

> **Addendum (2026-09-12, supplementary proof-of-scale)**: In addition to the synthetic dataset, we reference the public **[Kaggle "Bank Customer Segmentation" dataset (1M+ real transactions from an Indian bank)](https://www.kaggle.com/datasets/shivamb/bank-customer-segmentation)** (see `data/supplementary/README.md` for the citation, licensing note, and a documented field-mapping plan from Kaggle columns → our `Signals` schema). The synthetic personas remain the *primary* demo data (deterministic, narratively scripted); the Kaggle reference is cited only to demonstrate that the pipeline's tool contracts generalize beyond hand-crafted data.

---

## ADR-008: SQLite/JSON for Data, Not Postgres/Supabase

**Status**: ✅ Accepted (hackathon) / **Proposed** (production note only)
**Date**: 2026-09-12

### Context

A real deployment would need a proper database, but none of that is worth building for a 36-hour demo with ~20 synthetic customers.

### Decision

**Persist the synthetic dataset as JSON files loaded at startup** (or SQLite if query capability is needed). Document, but do not build, the production database path.

### Rationale

1. **Zero Overhead**: No database setup, no connection management, no migrations.
2. **Cheap Durability**: JSON/SQLite survives process restarts (unlike in-memory dicts).
3. **All build time stays on judge-visible features.**

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Supabase (Postgres)** | Good option but pure overhead at ~20-customer scale. Hours better spent on Features 3, 6, 7, 9 |
| **Standing up Postgres locally** | Same as Supabase — overhead with no demo benefit |
| **In-memory only** | Mildly risky if process restarts mid-judging |

### Consequences

- (+) All build time stays on judge-visible logic
- (+) "Production path" paragraph gives credible scalability answer without building it
- (–) None material for a 36-hour build

**Judging impact**: Supports "scalability" narrative credibly and cheaply.

---

## ADR-009: Prompt Engineering, Not Fine-Tuning

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

Each AI tool needs specialized behavior. We need to decide between fine-tuning, RAG, or prompt engineering.

### Decision

**Use structured prompt engineering with few-shot examples and response schemas.** No fine-tuning, no RAG (unless time permits for stretch goal).

### Rationale

1. **Time Constraint**: Fine-tuning requires datasets, training, evaluation. Impossible in 36 hours.
2. **Team Skill**: Prompt engineering is a core GenAI skill the team possesses.
3. **Iterability**: Prompts tweaked in seconds. Fine-tuned models require retraining.
4. **Transparency**: Prompts are readable and auditable — judges can see exactly what instructions each tool follows.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Fine-tuning Gemini** | No labeled dataset, no time, no infrastructure |
| **Fine-tuning open-source** | Requires GPU infrastructure, training pipeline. Not feasible in 36 hours |
| **RAG with financial documents** | Adds embedding pipeline, vector DB. Complexity not justified for primary use case. Kept as P3 stretch |

### Consequences

- (+) Zero training time — all time on product development
- (+) Prompts serve as documentation
- (–) Less specialized than fine-tuned model (acceptable — Gemini is already quite capable)

**Judging impact**: Indirect — maximizes time for judge-visible features.

### Implementation Notes

- Each tool has a dedicated system prompt in `src/lib/tools/prompts/`
- Use `responseMimeType: "application/json"` with `responseSchema` for typed outputs
- Temperature: 0.2 for analysis (deterministic), 0.7 for chatbot (conversational)
- Keep prompts in version control as plain text — easy to iterate live

---

## ADR-010: Vercel for Deployment

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

The demo needs a publicly accessible URL. Must be free, fast to deploy, and compatible with Next.js.

### Decision

**Deploy to Vercel free tier** using GitHub integration.

### Rationale

1. **Next.js Native**: Zero configuration needed.
2. **GitHub Integration**: Push to `master` → automatic deployment.
3. **Free Tier**: Sufficient for hackathon (100GB bandwidth, serverless functions).
4. **HTTPS by Default**: Professional-looking URLs.
5. **India Edge**: Fast page loads from Vercel's Mumbai edge nodes.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Railway** | Less native Next.js support. Requires buildpack config |
| **Netlify** | Less optimal for Next.js API routes and server components |
| **Local demo only** | Risky if laptop crashes during presentation |

### Consequences

- (+) Zero deployment config, professional URL
- (–) Serverless function timeout (10s on free tier — optimize agent pipeline)

**Judging impact**: Indirect — reliable demo infrastructure.

### Implementation Notes

Environment variables for Vercel:
- `GEMINI_API_KEY` — Google Gemini API key
- Any other secrets needed

---

## ADR-011: LLM as Narrator, Not Decision-Maker — Deterministic Tools for Financial Logic

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

The core challenge asks for personalized recommendations, conversational simplification, and stress detection. The team's strength is agentic AI/GenAI. Judging explicitly rewards explainability and compliance readiness.

A critical design question: should the LLM make the financial decisions (e.g., "should this customer get a loan?"), or should deterministic code make the decisions while the LLM only narrates/explains them?

### Decision

**The LLM is a decision *narrator*, not a decision *maker*, for anything financial.** Use the LLM orchestrator to call deterministic TypeScript tools (`recommendProduct`, `detectStressSignals`, `checkConsent`, `wellnessGateCheck`) for anything that produces a financial determination. The LLM is only used to (a) decide which tool(s) to call and in what order, and (b) phrase the output in plain, empathetic language. Only the vernacular conversation tool is itself LLM-backed end-to-end.

### Rationale

1. **Explainability**: A deterministic function's output can be traced to specific signals and thresholds. An LLM's output cannot. When a judge asks "why did the AI recommend this?", we can point to `savings_rate = 0.32 > 0.2 threshold` — not "the model felt it was a good fit."
2. **Auditability**: A regulator (or a judge role-playing one) can inspect the scoring function's code and verify it's fair. An LLM prompt is not inspectable in the same way.
3. **Testability**: Every tool is independently testable via a raw API call. If the LLM's phrasing is imperfect on stage, the underlying logic is demonstrably correct.
4. **Anti-Predatory Enforcement**: A hard-coded Wellness Gate (ADR-012) is meaningless if the LLM can independently decide to recommend a loan without calling it. The LLM-as-narrator pattern ensures the gate is always in the loop.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **LLM makes all decisions via prompt** | Not auditable. "We prompted it to be nice" is not a credible compliance answer. Judges will catch this |
| **6 separate LLM-powered agents** | Same problem — every agent being LLM-powered means financial decisions are non-deterministic |
| **Fully deterministic, no LLM** | Fails "innovation" criterion. Produces stiff, non-empathetic language for stress interventions |

### Consequences

- (+) Every determination is independently testable — demo-risk mitigation
- (+) Directly answers "explainability" with an architecture-level argument
- (+) Gives you a defensible answer when asked "how does it actually work"
- (–) Slightly more upfront design work; mitigated by keeping tool schemas simple

**Judging impact**: Primary driver of "explainability & RBI/regulatory compliance readiness." Also the strongest defense against the "ChatGPT wrapper" critique.

---

## ADR-012: Hard-Coded Wellness Gate, Not LLM Discretion

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

Challenge point 3 explicitly warns against "purely punitive actions." The judging criterion "depth of personalization vs. genuine customer benefit (not just upsell)" implies judges will specifically probe for anti-predatory design. This is the hardest question a judge can ask: *"What stops your AI from pushing loans to a struggling customer?"*

### Decision

**Implement a hard-coded, non-LLM-overridable Wellness Gate** that sits between the recommendation tool output and the customer-facing response. If `emi_miss_count >= 2` OR the stress module flags "at risk," credit/loan/credit-card recommendations are **automatically suppressed** and replaced with a supportive check-in message and a lighter-touch option (restructuring, savings nudge).

```typescript
function wellnessGateCheck(customerId: string, proposedProduct: string): "passed" | "suppressed" {
  const signals = getCustomerSignals(customerId);
  const stress = detectStressSignals(customerId);
  if (CREDIT_PRODUCTS.includes(proposedProduct) && (
    signals.emiMissCount90d >= 2 || stress.isAtRisk
  )) {
    return "suppressed";
  }
  return "passed";
}
```

### Rationale

1. **Concrete Demoability**: You can literally demo the gate firing (Sunita persona) — a concrete, auditable behavior beats any amount of stated intent.
2. **Strongest Compliance Answer**: When asked "what stops predatory nudging?", you answer: "deterministic code, not a prompt." This is airtight.
3. **Cheapest High-Leverage Feature**: ~1-2 hours of code with outsized judging impact across two criteria.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Prompting the LLM to "avoid recommending loans to stressed users"** | Not enforceable or auditable. An LLM can be prompted around. "We asked it nicely" is not a credible compliance answer |
| **No suppression mechanism, just softer LLM language** | Fails to actually address "avoiding predatory nudging" — the offer is still shown |
| **LLM-based Compliance Agent deciding whether to suppress** | LLM judgment is non-deterministic. A judge can ask "what if the compliance agent hallucinates and approves?" |

### Consequences

- (+) Gives you the strongest possible answer to the hardest judge question
- (+) A small amount of code with outsized narrative power
- (–) Adds one more demo beat to rehearse — worth it given the leverage

**Judging impact**: **Single highest-leverage decision** for "genuine customer benefit" and "ethical safeguards." If you cut everything else, keep this.

> **Amendment (2026-09-12, implementation)**: The gate now pauses **all** sales-push products (credit, investment, insurance — e.g., SIP) for at-risk customers, not only credit, and it is the *single* suppression mechanism. `recommendProduct` no longer short-circuits stressed customers to `EMI_RESTRUCTURE`; it returns the customer's *natural* product, which the gate then visibly suppresses (`wellnessGateStatus: "suppressed"`) before substituting support. This makes the gate's "suppressed" state observable in the UI and audit log for the Sunita persona, exactly as this ADR's demo intent requires (verified in `scripts/verify-stress.ts` and `scripts/verify-chat-context.ts`).

---

## ADR-013: Structured Reason Traces as Data Contract from Day 1

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

Both recommendations and stress alerts need to be defensible to a judge and, in a real product, to a regulator. "Explainability" is an explicit judging criterion.

### Decision

**Every tool that produces a determination returns not just a result but a `reasonTrace: string[]`** of the specific signals/thresholds that led to it. This is decided at the data-shape level from the start — not bolted on later.

```typescript
interface ToolResult {
  // ... tool-specific fields
  reasonTrace: string[];  // e.g., ["savings_rate=0.32 > 0.2 threshold", "no active loan"]
  plainLanguageExplanation: string;  // LLM narrates the trace
}
```

### Rationale

1. **"Why am I seeing this?" cards become almost free** once this data shape exists in every tool's output.
2. **Reduces "black box" critique risk** from judges with compliance/banking background.
3. **Structured traces are independently verifiable** — unlike free-text LLM explanations, they show the actual computation.
4. **Retrofitting is expensive** — deciding this contract early is critical. Adding `reasonTrace` after tools are built requires rework.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Return only a final decision + confidence score** | A bare number is not an explanation. Would need retrofitting later |
| **Free-text LLM explanation with no structured trace** | Not independently verifiable. A prose explanation from the same model making the call isn't auditable |
| **Separate Explainability Agent** | Adds a separate LLM call. Explanations may not match actual computation. More complex, more failure modes |

### Consequences

- (+) Explainability UI is nearly free once data contract exists
- (+) Audit trail writes itself — log the reason traces
- (–) Requires this data contract to be decided and enforced early — hence this ADR

**Judging impact**: Foundational to the "explainability" criterion across every feature, not just one.

---

## ADR-014: First-Class Consent Ledger, Not an Afterthought Slide

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

The problem statement explicitly asks for a note on data privacy/consent (DPDP Act) and RBI data-localization norms as part of the ethical-safeguards deliverable.

### Decision

**Model consent as structured, per-category data on every customer** and require the orchestrator to call `checkConsent()` before reading signals, with a visible UI panel and audit log.

```typescript
interface CustomerConsent {
  transactions: boolean;
  location: boolean;
  spendCategories: boolean;
}
```

The orchestrator's system prompt explicitly requires: "Always call `checkConsent()` before calling `getCustomerSignals()`."

### Rationale

1. **Working Panel > Compliance Slide**: Most teams will mention consent in a presentation slide. A working UI panel with per-category toggles and an audit log is a cheap, visible way to outperform on this point.
2. **DPDP Act Alignment**: A single blanket "I agree" flag doesn't reflect the Act's principle of purpose-specific, granular consent. Per-category toggles directly align with DPDP.
3. **Low Cost, High Leverage**: ~2-3 hours of effort for disproportionate judging impact.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Single blanket "I agree" flag** | Doesn't reflect DPDP granularity. Reads as token gesture |
| **Consent mentioned only in slides, no working UI** | Most teams will do exactly this — a working panel differentiates |
| **No consent mechanism** | Fails to address an explicit deliverable |

### Consequences

- (+) Turns a "checkbox" deliverable into a demoable feature
- (+) Directly and cheaply satisfies compliance readiness criterion
- (–) Small additional data-modeling and UI cost (~2-3 hours)

**Judging impact**: Directly satisfies "explainability & RBI/regulatory compliance readiness" criterion.

---

## ADR-015: Rule-Based Stress Detection, Not Trained ML Model

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

Challenge point 3 asks for detection of financial stress/fraud signals. No labeled fraud/default data exists for this synthetic dataset, and training time is unavailable in 36 hours.

### Decision

**Implement stress detection as a transparent rule + rolling-window statistical engine** (missed-EMI counter, spend/inflow z-score, sudden category-shift detector). The LLM is used only to phrase the resulting intervention empathetically — never to make the stress determination itself.

### Rationale

1. **Honesty**: Training an ML model on synthetic data you generated yourself is circular and cannot be honestly validated. A transparent rule engine is more defensible.
2. **Explainability**: Every stress flag has a named, inspectable reason ("2 EMIs missed in 90 days") — exactly what the reason-trace data contract (ADR-013) needs.
3. **Defensibility**: When a judge asks "how do you know this isn't just noise?", you point to the specific rule and threshold.
4. **Intentional Design, Not a Shortcut**: Frame this openly in the demo — "We chose rule-based detection because it's auditable and explainable. An ML model trained on our own synthetic data would be fitting noise." Judges respect this honesty more than an unverifiable ML claim.

### Alternatives Considered

| Alternative | Why Rejected |
|---|---|
| **Isolation forest / autoencoder** | Without real labels, fitting noise. Less explainable than a named threshold rule. Cannot be honestly validated |
| **LLM deciding "is this customer stressed?"** | Non-deterministic, not auditable, risky if wrong in live demo |
| **No stress detection** | Fails to address Challenge 3 |

### Consequences

- (+) Every stress flag has a named, inspectable reason — feeds directly into reason traces
- (+) Defensible when challenged. Honest framing impresses judges
- (–) Less "impressive-sounding" than claiming a trained model — mitigated by the honest framing

**Judging impact**: Directly supports "explainability/compliance readiness" and "avoiding predatory" framing.

---

## Summary Table

| ADR | Decision | Primary Judging Criterion Served |
|---|---|---|
| 001 | Agentic orchestrator + deterministic tools | Innovation & feasibility, explainability |
| 002 | Google Gemini 2.0 (Flash + Pro) | Enables vernacular, fast demo |
| 003 | Next.js full-stack | Execution speed (indirect) |
| 004 | Custom orchestrator with LLM-as-narrator constraint | Innovation, explainability |
| 005 | Modular monolith, not microservices | Scalability (narrative) |
| 006 | Web Speech API for voice | Usability for vernacular-first users |
| 007 | Synthetic Bharat-specific dataset | Enables all demos |
| 008 | SQLite/JSON now, documented DB path later | Execution speed, scalability (narrative) |
| 009 | Prompt engineering, not fine-tuning | Execution speed (indirect) |
| 010 | Vercel deployment | Execution speed (indirect) |
| **011** | **LLM as narrator, not decision-maker** | **Explainability, compliance (critical)** |
| **012** | **Hard-coded Wellness Gate** | **Genuine benefit / anti-predatory (highest leverage)** |
| **013** | **Structured reason traces everywhere** | **Explainability (foundational)** |
| **014** | **First-class Consent Ledger** | **Compliance readiness** |
| **015** | **Rule-based stress detection, not ML** | **Explainability, honest design** |
| **016** | **LLM Guardrail Suite (prompt injection + output validation)** | **Ethical safeguards, compliance** |
| **017** | **Deterministic fraud/anomaly detection** | **Challenge 3 completeness (fraud + stress)** |
| **018** | **Contextual timing engine ("right moment")** | **Personalization depth** |
| **019** | **PII redaction before LLM processing** | **Privacy-by-design, DPDP Act** |
| **020** | **Automated eval suite for agentic pipeline** | **Technical feasibility, reliability** |

> **For any coding agent reading this ADR**: These decisions are FINAL for the hackathon. Do not introduce alternative technologies, frameworks, or approaches unless explicitly approved by the team. When implementing, follow the implementation notes in each ADR closely. The goal is a working, polished demo in 36 hours — not a production-grade system. ADRs 011-015 are the **strategic differentiators** — implement them carefully, they are what win the hackathon. ADRs 016-020 are the **winning edge** — features that directly address problem statement gaps most teams will miss.

---

## ADR-016: LLM Guardrail Suite

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

Our system accepts free-text user input (chatbot) and uses LLM-generated narrations in financial contexts. Without guardrails, the system is vulnerable to: prompt injection attacks, LLM hallucination of financial data (interest rates, EMI amounts), and output schema violations.

### Decision

**Implement a three-layer guardrail pipeline** that wraps ALL LLM interactions:

1. **Prompt Injection Shield**: Regex + keyword detection for common injection patterns (`ignore previous instructions`, `system prompt`, SQL injection, etc.). Applied BEFORE every LLM call.
2. **Output Schema Validator**: Validates that LLM outputs conform to expected types (product must exist in catalog, confidence 0-1, etc.).
3. **Financial Accuracy Guard**: Pattern-matches LLM narrations for specific financial figures (₹ amounts, % rates, EMI counts) and flags any that don't originate from deterministic tool output.

### Rationale

1. **Ethical safeguards** is an explicit deliverable in the problem statement.
2. "What stops the LLM from hallucinating a wrong interest rate?" is a devastating judge question with no answer if guardrails don't exist.
3. Demonstrates production AI safety thinking — extremely rare in hackathons.

### Consequences

- (+) Demoable: type an injection live → show it blocked
- (+) Addresses "ethical safeguards" deliverable at the LLM layer
- (–) Adds ~50ms latency per LLM call (negligible)

### Implementation Notes

- Create `src/lib/guardrails/promptInjection.ts`, `outputValidator.ts`, `financialGuard.ts`
- Wrap via `src/lib/guardrails/index.ts` pipeline
- Every guardrail check logged to audit trail

---

## ADR-017: Deterministic Fraud/Anomaly Detection

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

Challenge 3 explicitly says: *"Detect early warning signals of financial stress **or fraud** (unusual transaction patterns, missed EMIs, sudden behavior change)."* We built stress detection (ADR-015) but have no fraud detection. This is a gap in problem statement coverage.

### Decision

**Build a deterministic rule-based anomaly detection engine** with 5 named rules (unusual merchant, sudden large withdrawal, frequency spike, category shift, velocity check). Same architecture philosophy as stress detection — deterministic, explainable, auditable.

### Rationale

1. The word "fraud" is explicitly in Challenge 3.
2. "Unusual transaction patterns" and "sudden behavior change" are explicitly named.
3. Rule-based detection is consistent with our explainability-first architecture (ADR-011).

### Consequences

- (+) Closes a gap in Challenge 3 coverage
- (+) Each anomaly has a named reason (consistent with ADR-013)
- (–) Rules are illustrative, not calibrated against real fraud data (acceptable for hackathon)

---

## ADR-018: Contextual Timing Engine

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

Challenge 1 says: *"proactively recommend the most relevant banking product **at the right moment**."* Our current system recommends the right product but has no concept of timing — it doesn't know *when* to recommend.

### Decision

**Build a deterministic timing engine** that computes optimal recommendation moments based on transaction patterns: salary credits (savings momentum), festival proximity, EMI due dates, savings stability trends.

### Rationale

1. "At the right moment" is explicit in the challenge text.
2. Transforms "what to recommend" into the full "what + when + why now" trifecta.
3. Most teams will only answer "what" — timing is a differentiator.

### Consequences

- (+) Adds a "⏰ Why Now?" badge to recommendations — highly visual
- (+) Directly addresses the exact problem statement language
- (–) Timing rules are heuristic-based (acceptable — real timing would require historical patterns)

---

## ADR-019: PII Redaction Before LLM Processing

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

Even when user consent is granted, sending raw PII (Aadhaar, PAN, phone numbers, account numbers) to an LLM is a privacy risk. The DPDP Act principle of data minimization requires that only necessary data is processed.

### Decision

**Implement a PII redaction layer** that masks sensitive Indian PII formats before any data is sent to Gemini. Patterns: Aadhaar (XXXX-XXXX-1234), PAN (XXXXX1234X), phone (+91-XXXXX-67890), account numbers (XXXXXXXX1234), email (u***@example.com).

### Rationale

1. Defense-in-depth: consent toggles control *whether* data is accessed; PII redaction controls *what* the LLM sees.
2. "Data privacy" is an explicit deliverable.
3. Shows sophisticated privacy engineering at the data layer, not just UI toggles.

### Consequences

- (+) "Even with consent, the LLM never sees full Aadhaar numbers" — powerful compliance answer
- (+) Audit logged: "PII redacted: 2 fields masked before LLM processing"
- (–) 45 minutes of effort for outsized compliance credibility

---

## ADR-020: Automated Eval Suite for Agentic Pipeline

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

AI systems are notoriously difficult to test. Most hackathon teams rely entirely on manual testing. An automated eval suite that verifies the agentic pipeline behaves correctly across all personas and edge cases is a strong signal of engineering maturity.

### Decision

**Build a script (`scripts/eval-suite.ts`) with 12+ automated assertions** covering: consent checks, signal extraction correctness, wellness gate behavior, guardrail effectiveness, and recommendation reason traces.

### Rationale

1. "Technical feasibility" is a judging criterion — automated tests prove it.
2. Can be run live during Q&A: "Let me run our eval suite right now."
3. No hackathon team does this — it's a decisive differentiator.

### Consequences

- (+) Proves engineering rigor
- (+) Catches regressions during rapid hackathon development
- (+) Demoable artifact
- (–) 1.5 hours of effort (worth it for the judge impression)

---

## ADR-021: Grounded Chat Reasoning over Reason Traces (Explain-This-Recommendation Chat)

**Status**: ✅ Accepted
**Date**: 2026-09-12

### Context

The vernacular chat (ADR-002/ADR-006) originally had **no access** to the recommendation pipeline, so it could not answer the most natural user question: *"Why was this product recommended to me?"* The chat's `systemInstruction` was persona-only, and the chat API knew nothing about the reason traces (ADR-013), the wellness gate (ADR-012), or the user's consent state (ADR-014).

### Decision

1. **Deterministic context builder** (`src/lib/tools/getRecommendationContext.ts`): a pure-TypeScript, zero-LLM function that replays the full pipeline per chat turn — `checkConsent → getCustomerSignals → recommendProduct → computeStressCore → applyWellnessGate` — and returns the recommendation, wellness score, gate status, and the merged reason trace.
2. **Grounded system instruction**: the chat API injects this context into the model-level `systemInstruction`, with rules that the LLM is a *decision narrator, not a decision maker* (ADR-011): it may only explain the recommendation using facts present in the reason trace, and must never invent amounts, rates, or reasons.
3. **Consent-aware grounding**: if transaction consent is denied, the grounding block instructs the LLM to refuse to discuss transaction-derived data and to point the user to Privacy Controls (ADR-014).
4. **Output verification**: the chat reply passes through `checkOutputGuardrails` (ADR-016) with the deterministic tool output as ground truth; a flagged reply is replaced by a deterministic, trace-derived fallback narration, and the block is audit-logged.
5. **Graceful degradation**: if the Gemini call itself fails (invalid/missing API key), the API returns the deterministic fallback narration instead of a 500 — the demo works offline.
6. **UI affordance**: `ChatWidget` accepts the grounded recommendation and renders a *"Why <product>?"* quick chip that sends a pre-written explanation question (English/Hinglish per language toggle).

### Rationale

1. Completes the explainability loop: reason traces (ADR-013) are now consumable *by the user*, not just by judges reading an audit panel.
2. Keeps ADR-011's invariant airtight — even in free-form chat, financial facts can only come from deterministic tools.
3. The fallback narration makes the chat 100% reliable during demos even with no API key.

### Consequences

- (+) "Ask the chatbot why it recommended this" is a compelling live-demo beat
- (+) Hallucination of personalized financial figures is structurally blocked, not just prompted against
- (–) One extra deterministic computation per chat turn (negligible — no LLM cost)

> **SDK notes (verified live against `@google/generative-ai` 0.24.x, Sep 2026)**:
> 1. `systemInstruction` must be set on `getGenerativeModel()`. Passing it to `startChat()` produces `400 Bad Request: Invalid value at 'system_instruction'`. All chat models are created via `createChatModel()` in `src/lib/gemini.ts` which applies this correctly.
> 2. **Model pin**: `gemini-2.0-flash`/`gemini-2.5-flash` are retired for API projects created Sep 2026, and `gemini-3.6+` rejects the legacy `role: "function"` turn the SDK 0.24.x function-calling loop sends (`400: Role 'function' is not supported`). We pin `gemini-3.5-flash`, the newest stable model that still accepts it (verified 200 on a functionResponse turn). `sendWithRetry()` in `src/lib/gemini.ts` absorbs free-tier 429s (~5 req/min, ~20 req/day per model) before degrading to deterministic fallbacks.




## ADR-022: Experimental ML Risk Prediction Model

**Status**: ? Accepted (implemented as Feature 26 "RiskNet" � pure-TS logistic regression, from scratch)

**Date**: 2026-09-12 (amended at implementation time)

### Context

We want to demonstrate advanced machine-learning capability while keeping the core decision path deterministic. The dataset provides 15 customers x 6 months of transactions (~90 customer-month observations) � enough to train a small linear model honestly, but far too little for deep learning or gradient-boosted ensembles without overfitting.

An earlier draft of this ADR proposed gradient-boosted trees; that was rejected at implementation time because (a) ~90 rows cannot support a tree ensemble without severe overfitting, and (b) tree ensembles are harder to explain per-prediction than a linear model, which conflicts with our explainability-first narrative (ADR-011, ADR-013).

### Decision

Build a **logistic regression classifier entirely from scratch in pure TypeScript** (no ML libraries, no Python, no new runtime dependencies):

- **Training** (`scripts/train-ml-model.ts`): batch gradient descent with L2 regularization and feature standardization. Training data is derived from `transactions.json` with a **strict month-m -> month-(m+1) label split**: features are computed from month m only, and the label is `1` if the customer missed an EMI in month m+1. This eliminates label leakage (a prior draft labeled each row using the rule engine's verdict on the same signals used as features � a tautology that inflates accuracy).
- **Artifact** (`src/data/risk-model.json`): committed, versioned, contains `{ featureNames, means, stds, weights, bias, trainingMeta }`. Inference at request time is a dot product � deterministic and instant. Training happens only at build time, never at request time.
- **Inference** (`src/lib/tools/predictRiskScore.ts`): loads the artifact, returns `{ probability, riskBand, topFactors }` as a `ToolResult` with reason traces. `topFactors` are per-prediction attributions (`weight_i x standardized x_i`, which sum exactly to the logit) � the model's reasoning is displayed, not hidden.
- **Integration**: advisory-only. `predictRiskScore` is registered consent-gated in the orchestrator and surfaced in the dashboard as an "ML Risk Gauge". `detectStressSignals` may *mention* the ML probability in its reason trace, but the ML output **never flips** `isAtRisk`, never overrides the wellness score, and never changes the recommended intervention. The deterministic rule engine remains the sole decision maker.

### Rationale

- **Innovation signal** � a genuine from-scratch ML pipeline (data prep -> train -> evaluate -> inference -> attribution) with zero ML libraries.
- **Explainability preserved** � readable weights double as global feature importance; per-prediction attributions plug into the existing reason-trace pattern.
- **Honest evaluation** � leave-one-customer-out cross-validation reports real generalization; the tool exposes its own training metrics rather than overclaiming.
- **Deterministic discipline** � fixed-iteration batch gradient descent (no sampling); re-running the trainer produces bit-identical artifacts.

### Consequences

- (+) Judges see real ML craftsmanship: the model's brain (weights) is inspectable on stage.
- (+) Zero new dependencies; inference is ~30 lines of pure TS.
- (-) Small-sample caveat: with ~90 training rows, metrics are modest. The tool is **clearly marked experimental and is never used for compliance decisions**; a model-version field in the artifact makes stale-model detection possible.
- (-) Feature set is limited to what `Signals`/transactions can express; richer features are future work.

---
