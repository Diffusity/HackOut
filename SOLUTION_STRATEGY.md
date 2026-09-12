# 🏆 Solution Strategy: AI-Powered Hyper-Personalized Banking for Bharat

## Product Name: **DhanSathi** (धनसाथी — "Your Financial Companion")

> **Tagline**: _"Banking that understands you — in your language, at your pace, for your life."_

> **Document purpose**: This is the single source of truth for what to build, why, and in what order. Written so that a human teammate *or* an AI coding agent picking this up cold can understand the full context and start implementing without needing the original problem-statement image. A companion `ADR.md` in this repo captures the architectural decisions and their trade-offs.

---

## 1. Problem Statement Summary

**Theme**: Digital Transformation in Lending
**Title**: AI-Powered Hyper-Personalized Banking for Bharat

Indian banks sit on goldmines of transactional and behavioral data but deliver a **one-size-fits-all digital experience**. This hurts:

- **Customers** (especially Tier 2/3/4 & rural India): Confusing apps, irrelevant product pushes, language barriers, fear of digital banking.
- **Banks**: High customer acquisition costs, loan journey drop-offs, inability to cross-sell, and late detection of financial distress leading to NPAs.

### The 3 Core Challenges

| # | Challenge | What Judges Want to See |
|---|-----------|------------------------|
| 1 | **Smart Product Recommendation** | Analyze transactions → recommend the RIGHT product at the RIGHT time (not spam) |
| 2 | **Vernacular Conversational Banking** | Chatbot in Hindi, Tamil, Telugu, etc. that simplifies onboarding, KYC, loan applications |
| 3 | **Early Warning & Empathetic Intervention** | Detect financial stress/fraud signals → intervene with empathy, not punishment |

### Deliverables Expected
- A conceptual architecture/flow diagram (data sources → AI engine → personalized output/action)
- A working prototype or wireframe showing the customer journey
- An explanation of the AI/ML approach used
- A note on ethical safeguards (DPDP Act, RBI data localization, algorithmic bias, avoiding predatory nudging)

### Judging Criteria
1. Innovation and technical feasibility
2. Depth of personalization vs. genuine customer benefit (not just upsell-driven)
3. Explainability and RBI/regulatory compliance readiness
4. Usability for non-tech-savvy and vernacular-first users
5. Scalability across a bank's existing digital infrastructure and social/financial impact

### Team Constraints
- **Duration**: ~36-hour hackathon
- **Team size**: 3 members
- **Stack**: Next.js (TypeScript) full-stack
- **Strengths**: Full-stack development, Agentic AI/GenAI, transformers, foundational ML
- **LLM Access**: Google Gemini API
- **Demo format**: Live demo + presentation
- **Deployment**: Vercel free tier

---

## 2. Why DhanSathi Wins — Strategic Thesis

### 2.1 The Competitive Landscape (What Other Teams Will Build)

Most competing teams will build: a recommendation dashboard using a generic collaborative-filtering pitch, a chatbot that's really just a wrapped LLM prompt, and a slide claiming "we use ML for fraud detection" with no real logic behind it. This satisfies "innovation" weakly and completely fails "explainability" and "avoiding predatory nudging."

### 2.2 Our Core Insight: Agentic AI with Deterministic Accountability

We win by building an **Agentic AI System** — an LLM orchestrator that calls **deterministic, auditable tools** for every financial decision. The LLM decides WHAT to do and HOW to say it, but **never WHAT the financial answer is**. This is:

- **Technically innovative** — Real tool-calling agentic design, not a "ChatGPT wrapper"
- **Genuinely explainable** — Every recommendation traces back to named signals and thresholds, not LLM intuition
- **Defensible under judge questioning** — "The LLM narrates; deterministic code decides" is an airtight compliance answer
- **Aligned with our strengths** — Agentic AI + Gen AI + Full-stack = our sweet spot

### 2.3 The Wellness Gate — Our Highest-Leverage Feature

The single most powerful demo moment: a **hard-coded, non-LLM-overridable business rule** that automatically suppresses credit/loan recommendations for financially stressed customers. When a judge asks *"What stops your AI from pushing loans to a struggling customer?"*, our answer is: **deterministic code, not a prompt.**

This is the cheapest feature to build (~1-2 hours) with the highest judging ROI across two criteria: "genuine customer benefit" and "ethical safeguards."

### 2.4 How We Map to Judging Criteria

| Judging Criterion | Our Strategy | Primary Feature(s) | Why We Score High |
|---|---|---|---|
| **Innovation & Technical Feasibility** | Agentic orchestrator with real tool-calling — not prompt-chaining theatre | Agent Orchestrator + Tool-use architecture | Genuinely more sophisticated than what most teams implement; working demo proves feasibility |
| **Depth of Personalization vs. Genuine Benefit** | Wellness Gate proves we're not just upselling + every recommendation has a "why" | Wellness Gate + Reason Traces | Concrete, demoable mechanism — not just stated intent |
| **Explainability & RBI/Compliance** | Every determination returns a structured `reason_trace` + Consent Ledger mapped to DPDP Act | Reason Traces + Consent Ledger Panel | Cheap to build, disproportionately impresses judges because almost no one does it |
| **Usability for Vernacular-First Users** | Voice + text chatbot in Hindi/English with financial literacy nudges | Vernacular Chatbot + Voice Interface | Live Hindi voice demo is a showstopper — highly visual and memorable |
| **Scalability & Social Impact** | Modular architecture with clear service boundaries + financial inclusion narrative | Architecture Design + ADR narrative | Credible design story without over-engineering |

---

## 3. Solution Architecture

### 3.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                      DhanSathi Platform                            │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  DATA SOURCES (synthetic)                                          │
│  Salary credits · UPI/txn history · EMI schedule · KYC · consent   │
│                          │                                         │
│               ┌──────────▼───────────┐                             │
│               │  SIGNAL EXTRACTION    │                             │
│               │  (deterministic TS)   │                             │
│               │  salary_regularity,   │                             │
│               │  savings_rate,        │                             │
│               │  emi_miss_count,      │                             │
│               │  spend_volatility,    │                             │
│               │  life_stage_tags      │                             │
│               └──────────┬───────────┘                             │
│                          │                                         │
│         ┌────────────────▼─────────────────┐                       │
│         │     AGENT ORCHESTRATOR (Gemini)    │                      │
│         │  Reads signals → decides which     │                      │
│         │  tool to call → narrates result    │                      │
│         │  in plain, empathetic language      │                      │
│         └───┬──────────┬──────────┬────┬────┘                      │
│             │          │          │    │                            │
│    ┌────────▼───┐ ┌────▼─────┐ ┌─▼────▼──────┐ ┌───────────────┐  │
│    │Product     │ │Stress/   │ │Consent      │ │Vernacular     │  │
│    │Recommender │ │Risk      │ │Ledger       │ │Conversation   │  │
│    │Tool        │ │Tool      │ │Tool         │ │Tool           │  │
│    │(determ-    │ │(rule +   │ │(policy      │ │(LLM-backed,   │  │
│    │ inistic    │ │ stats    │ │ check)      │ │ Hindi+English │  │
│    │ scoring +  │ │ engine)  │ │             │ │ + Voice)      │  │
│    │ LLM        │ │          │ │             │ │               │  │
│    │ narrative) │ │          │ │             │ │               │  │
│    └────────┬───┘ └────┬─────┘ └─┬──────────┘ └┬──────────────┘  │
│             │          │         │              │                  │
│             └────┬─────┴────┬────┘              │                  │
│                  │          │                    │                  │
│        ┌─────────▼───┐ ┌───▼──────────┐         │                  │
│        │ WELLNESS    │ │ AUDIT/REASON  │         │                  │
│        │ GATE        │ │ TRACE LOGGER  │         │                  │
│        │ (hard rule, │ │               │         │                  │
│        │ NOT LLM)    │ │               │         │                  │
│        └─────────┬───┘ └───┬──────────┘         │                  │
│                  │         │                    │                  │
│        ┌─────────▼─────────▼────────────────────▼──────────────┐   │
│        │                  NEXT.JS API ROUTES                    │   │
│        └─────────┬─────────────────────┬───────────────────────┘   │
│                  │                     │                            │
│     ┌────────────▼──────┐   ┌──────────▼────────────────┐          │
│     │ React Dashboard   │   │ React Chat Widget          │         │
│     │ (Customer 360,    │   │ (vernacular onboarding     │         │
│     │  "why" cards,     │   │  + loan journey +          │         │
│     │  wellness gauge,  │   │  voice input/output)       │         │
│     │  consent panel)   │   │                            │         │
│     └───────────────────┘   └────────────────────────────┘         │
└────────────────────────────────────────────────────────────────────┘
```

### 3.2 The Key Architectural Choice

The orchestrator is a Gemini LLM using **function-calling/tool-use**, but the tools it calls are mostly **deterministic TypeScript code**, not more LLM calls. Only the vernacular conversation tool is itself LLM-backed end-to-end. This hybrid is deliberate (see `ADR-001` and `ADR-011`) because:

- A fully black-box LLM pipeline fails the **"explainability"** judging criterion
- A fully deterministic pipeline fails the **"innovation"** criterion
- The hybrid gives us both: **innovation** from agentic orchestration + **explainability** from deterministic tools

**The LLM is a decision *narrator*, not a decision *maker*, for anything financial.** It always calls a tool to get the underlying determination; its job is to explain it in plain, empathetic language.

### 3.3 The 5 Tools + Orchestrator

Each tool is a TypeScript function exposed to the LLM via function-calling schemas. Every tool returns a structured `reason_trace: string[]` alongside its result — this is a data-contract decision made from day 1, not bolted on later.

#### Tool 1: 🔍 `getCustomerSignals(customerId)` — Signal Extraction
**Type**: Deterministic TypeScript
**Role**: Transforms raw transaction history into named, interpretable signals.

**Output signals**:
- `salaryRegularityScore` (0-1) — How regular are salary credits?
- `savingsRate` (0-1) — What fraction of income is saved?
- `emiMissCount90d` (integer) — EMIs missed in last 90 days
- `spendVolatility30d` (float) — Spend variability over last 30 days
- `incomeType` — `"salaried"` | `"gig"` | `"self_employed"`
- `lifeStageTags` — e.g., `["first_time_saver", "recent_salary_hike", "wedding_spending"]`

**Why deterministic**: Named, computed signals are explainable ("savings_rate = 0.32"), testable (unit test the function), and auditable (a regulator can inspect the formula). LLM-extracted signals are none of these.

**Impact**: 🔴 CRITICAL — Every other tool depends on this output.

#### Tool 2: 🎯 `recommendProduct(signals)` — Product Recommendation
**Type**: Deterministic scoring + LLM narrative
**Role**: Matches banking products to customer needs based on computed signals.

**What it does**:
- Takes computed signals as input
- Runs a deterministic scoring function (weighted rules / decision table) to select the most relevant product category (savings/investment, credit, insurance, flexible loan)
- Returns structured output with `reason_trace`:
  ```typescript
  {
    product: "Recurring Deposit",
    confidence: 0.85,
    reasonTrace: ["savings_rate=0.32 > 0.2 threshold", "salary_regularity=0.95 (stable income)", "no active loan"],
    wellnessGateStatus: "passed" | "suppressed"
  }
  ```
- The LLM then narrates the `reasonTrace` into a human-readable "Why this recommendation" explanation

**Why deterministic scoring, not collaborative filtering**: No user-item interaction history exists in hackathon data. Scoring off interpretable signals is both more honest and more explainable.

**Why not a single giant LLM prompt**: Judges increasingly recognize "ChatGPT wrapper" solutions. Tool-use architecture demonstrates real engineering.

**Impact**: 🔴 CRITICAL — This is the #1 feature judges will evaluate.

#### Tool 3: 🛡️ `detectStressSignals(customerId)` — Financial Stress Detection
**Type**: Deterministic rule + rolling-window statistical engine
**Role**: Flags customers showing signs of financial distress.

**What it does**:
- Missed-EMI counter (≥2 in 90 days = flagged)
- Spend/inflow z-score over trailing 30-day window (z > 2.0 = unusual)
- Sudden spend-category shift detector (e.g., spike in cash withdrawals)
- Savings balance decline below 1-month-expense threshold
- Returns structured output:
  ```typescript
  {
    isAtRisk: true,
    wellnessScore: 38, // 0-100
    reasons: ["2 EMIs missed in last 90 days", "savings below 1-month safety threshold"],
    recommendedIntervention: "empathetic_checkin" | "restructuring_offer" | "counselor_connect"
  }
  ```
- The LLM then phrases the intervention in empathetic, non-judgmental language

**Why rule-based, not a trained ML model**: With only synthetic data and no real fraud/default labels, training a model would be fitting noise and cannot be honestly validated. This is an **intentional, explainability-first design choice**, not a shortcut — transparent rules are exactly what a compliance-minded judge expects. State this openly in the demo; judges respect the honesty more than an unverifiable ML claim.

**Why not LLM deciding "is this customer stressed?"**: Non-deterministic, not auditable, and risky if the model's judgment is wrong in a live demo with no way to explain why.

**Impact**: 🔴 CRITICAL — Directly addresses Challenge #3 and scores high on "social/financial impact."

#### Tool 4: ⚖️ `checkConsent(customerId, dataScope)` — Consent Ledger
**Type**: Deterministic policy check
**Role**: Verifies customer consent before any data access.

**What it does**:
- Checks per-category consent flags: `{ transactions: bool, location: bool, spendCategories: bool }`
- Returns `true/false` with audit log entry of what was accessed and when
- The orchestrator is instructed to ALWAYS call this BEFORE calling `getCustomerSignals()`

**Why granular, not a blanket "I agree"**: DPDP Act requires purpose-specific, granular consent. A single toggle doesn't reflect this and reads as a token gesture. Most teams will mention consent in a slide; we have it as a **working UI panel** — a cheap way to visibly outperform on this specific criterion.

**Impact**: 🟠 HIGH — Turns a "checkbox deliverable" into a demoable feature.

#### Tool 5: 🗣️ `vernacularReply(userMessage, language)` — Vernacular Conversation
**Type**: LLM-backed end-to-end (the ONLY fully LLM-powered tool)
**Role**: Handles conversational interactions in Hindi/English with voice support.

**What it does**:
- Powers the chatbot with text chat in vernacular languages (Gemini's native multilingual capability)
- Voice input/output via Web Speech API (browser-native, zero cost)
- Simplifies complex banking journeys conversationally:
  - Loan application: "Mujhe ghar khareedne ke liye loan chahiye" → Guided journey
  - KYC: Collects and validates data conversationally
  - Product queries: Explains FD rates, EMI calculations in simple language
- Adapts to user's digital literacy level
- Tolerates Hinglish/code-mixing naturally
- Uses financial literacy nudges: Explains concepts like EMI, interest rates in simple terms

**Why this is the only LLM-backed tool**: Conversation requires the full generative power of an LLM — deterministic rules can't handle free-form multilingual dialogue. But financial determinations (recommendations, stress flags) use deterministic tools for explainability.

**Impact**: 🟠 HIGH — Key differentiator for demo, high visual impact. Live Hindi voice demo is a showstopper.

#### The Wellness Gate — Hard-Coded Anti-Predatory Rule

**Type**: Deterministic, non-LLM-overridable business rule
**Position**: Sits BETWEEN the recommendation tool output and the customer-facing response. Cannot be bypassed by the LLM.

```typescript
function wellnessGateCheck(customerId: string, proposedProduct: string): "passed" | "suppressed" {
  const signals = getCustomerSignals(customerId);
  const stress = detectStressSignals(customerId);
  
  if (CREDIT_PRODUCTS.includes(proposedProduct) && (
    signals.emiMissCount90d >= 2 || stress.isAtRisk
  )) {
    return "suppressed"; // Replace with supportive check-in
  }
  return "passed";
}
```

**Why hard-coded, not LLM discretion**: "We prompted the LLM to be nice" is not enforceable, not auditable, and not a credible compliance answer. A deterministic gate that a judge can literally watch fire in the demo is the single most powerful answer to the hardest judge question: *"What actually stops your AI from upselling a struggling customer?"*

**Impact**: 🔴 CRITICAL — Single highest-leverage feature for "genuine customer benefit" and "ethical safeguards" criteria. ~1-2 hours to build, outsized judging ROI.

---

## 4. Feature List — Prioritized Implementation Order

### Priority Legend
- 🔴 **P0 — Core Spine** (Build first; must work end-to-end before starting P1)
- 🟠 **P1 — Differentiators** (Significantly increases win probability)
- 🟡 **P2 — Polish & Proof Points** (Cherry on top)
- ⚪ **P3 — Stretch** (Only if time remains in final hours)

### Critical Rule: Build in tier order. Do not start P1 until all P0 features have a working end-to-end path, even a rough one. A thin end-to-end slice beats a polished but disconnected feature every time in a live demo.

### P0 — Core Spine (~14-16 hours)

| Order | Feature | Time | Owner | What & Why |
|-------|---------|------|-------|------------|
| **1** | **Synthetic Data Generator** | 2h | M1 | Generate ~15-20 synthetic Indian customer profiles with 6 months of realistic transactions (UPI, salary credits, EMI debits, festival spending). Include the 3 demo personas. Without this, nothing else works. |
| **2** | **Project Scaffolding & UI Shell** | 2h | M2 | Next.js app with dark-themed dashboard layout, navigation, responsive design. The visual home base for the entire demo. |
| **3** | **Signal Extraction Layer** | 2-3h | M3 | Deterministic TypeScript functions: `salaryRegularityScore`, `savingsRate`, `emiMissCount90d`, `spendVolatility30d`, `incomeType`, `lifeStageTags`. This feeds everything downstream. |
| **4** | **Agentic Recommendation Engine** | 4-5h | M3 | Gemini orchestrator + deterministic `recommendProduct()` scoring function + LLM narrative. Every output includes structured `reasonTrace`. This is the headline feature. |
| **5** | **Explainable "Why This" Reasoning Layer** | 1-2h | M3 | Not a separate module — baked into Feature 4's output shape. Every recommendation returns `{product, confidence, reasonTrace, plainLanguageExplanation}`. Frontend renders expandable "Why am I seeing this?" cards. |
| **6** | **Customer 360 Dashboard** | 4-5h | M2 | Customer summary card, income/spend timeline chart (Recharts), recommendation feed with "why" cards, financial wellness score gauge. Primary demo surface. |

### P1 — Differentiators (~10-12 hours)

| Order | Feature | Time | Owner | What & Why |
|-------|---------|------|-------|------------|
| **7** | **Vernacular Chatbot (Text + Voice)** | 4-5h | M1 | Chat widget with Gemini-powered Hindi/English conversation. Web Speech API for voice input/output. Walks first-time users through loan applications, KYC, product queries in vernacular. Most visually memorable feature in a live demo. |
| **8** | **Financial Stress Detection Module** | 3-4h | M3 | Deterministic rule + statistical engine. Wellness score (0-100). Empathetic intervention messages phrased by LLM. Demo: show Sunita's wellness score dropping after missed EMIs. |
| **9** | **Wellness Gate Guardrail** | 1-2h | M3 | Hard-coded rule: if stressed → suppress credit offers, show supportive check-in instead. Implement as soon as Features 4 and 8 exist. This is ~1 hour of code with outsized demo impact. **Treat as P0-priority for the pitch narrative.** |
| **10** | **Consent Ledger & Privacy Panel** | 2-3h | M1+M2 | Per-category consent toggles (transactions, location, spend_categories) + audit log of AI data access. `checkConsent()` called before any data access. Working UI panel > a slide about privacy. |

### P2 — Polish & Proof Points (~6-8 hours)

| Order | Feature | Time | Owner | What & Why |
|-------|---------|------|-------|------------|
| **11** | **Persona-Based Demo Storylines** | 1-2h | All | Pre-seeded data states for 3 demo personas. Rehearsed 3-4 minute walkthrough. Demo reliability is a judging factor — scripted personas guarantee hitting all 3 challenge points. |
| **12** | **Loan Journey Flow** | 2-3h | M2 | Guided loan application via chatbot with visual progress tracking. |
| **13** | **Architecture & Compliance One-Pager** | 1-2h | M1 | Exported architecture diagram + written DPDP/RBI compliance note + bias mitigation note. Explicitly requested deliverable — skipping it costs points. |
| **14** | **Deployment & Final Polish** | 2h | All | Deploy to Vercel, cached API response fallback for demo personas, end-to-end testing, demo rehearsal × 3. |

### P3 — Stretch Goals (only if time remains)

| Order | Feature | Time | Owner | What & Why |
|-------|---------|------|-------|------------|
| **15** | **Additional Vernacular Languages** | 1h | M1 | Tamil, Telugu, Kannada, Bengali — Gemini handles natively, just adjust prompt parameter. |
| **16** | **Banker/Admin Dashboard View** | 2h | M2 | Portfolio-level view for bank relationship managers. |
| **17** | **Recommendation Fairness Check** | 1-2h | M3 | Post-hoc check that recommendations aren't skewed by income band or demographics. "Fairness note" in compliance panel. |
| **18** | **Lightweight RAG for Banking FAQ** | 2h | M1 | Small in-memory vector index over bank policy docs so chatbot can answer "what documents do I need for KYC?" |

---

## 5. Features NOT Included (And Why)

| Feature Considered | Why Rejected | Risk of Including |
|---|---|---|
| **Custom ML model training** | Team's ML knowledge is foundational, not specialist. No labeled data. Training on synthetic data you generated yourself is circular and cannot be honestly validated | High risk of demo failure, dishonest if challenged by judges |
| **Isolation forest / autoencoder anomaly detection** | Without real labels, "trained" model fits noise. Less explainable than a named threshold rule. Judges will ask "how do you know this isn't noise?" | Worse for explainability than rule-based, can't be honestly defended |
| **LLM directly deciding financial outcomes** | Non-deterministic, not auditable. "We prompted it to be nice" is not a compliance answer | Fails explainability criterion, risky in live demo |
| **Blockchain for audit trail** | Over-engineered, buzzword stuffing. Simple database audit log is sufficient and more honest | Wastes 4+ hours, judges see through it |
| **Real banking API integration** | No sandbox available. Mock data is expected in hackathon context | Would require mocking anyway, less polished |
| **Mobile app (React Native/Flutter)** | 36 hours too tight for web + mobile. Web sufficient for demo | Both platforms end up half-baked |
| **Custom NLP model for vernacular** | Gemini handles multilingual natively, far better than anything trainable in 36 hours | Reinventing the wheel, worse quality |
| **Microservices architecture** | Operational overhead (multiple deployments, service discovery) would consume most of 36 hours on infrastructure invisible to judges | Zero demo value, all plumbing |
| **GraphQL** | Adds schema/tooling overhead with no judge-visible benefit at this data scale (~20 customers, handful of endpoints) | Pure overhead |
| **Standing up PostgreSQL** | Pure overhead at ~20-customer scale. Supabase/SQLite sufficient for demo | Hours better spent on demo features |

---

## 6. Data Model

```typescript
interface Customer {
  customerId: string;
  name: string;
  segment: "salaried" | "gig" | "self_employed";
  cityTier: 2 | 3 | 4;
  preferredLanguage: "hi" | "en" | "ta" | "te" | "kn" | "bn";
  consent: {
    transactions: boolean;
    location: boolean;
    spendCategories: boolean;
  };
}

interface Transaction {
  txnId: string;
  customerId: string;
  timestamp: Date;
  amount: number;
  type: "credit" | "debit";
  category: "salary" | "emi" | "upi_spend" | "bill" | "transfer" | "investment" | "other";
  merchant?: string;  // e.g., "Swiggy", "BigBazaar", "LIC Premium"
  mode: "UPI" | "NEFT" | "IMPS" | "ATM" | "POS" | "auto_debit";
}

interface Signals {
  customerId: string;
  salaryRegularityScore: number;    // 0-1
  savingsRate: number;              // 0-1
  emiMissCount90d: number;
  spendVolatility30d: number;
  incomeType: "salaried" | "gig" | "self_employed";
  lifeStageTags: string[];          // e.g., ["first_time_saver", "recent_salary_hike"]
  monthlyIncome: number;
  monthlyExpense: number;
}

interface Recommendation {
  customerId: string;
  product: string;
  confidence: number;
  reasonTrace: string[];            // e.g., ["savings_rate=0.32 > 0.2 threshold", "no active loan"]
  plainLanguageExplanation: string;
  wellnessGateStatus: "passed" | "suppressed";
}

interface StressAlert {
  customerId: string;
  isAtRisk: boolean;
  wellnessScore: number;            // 0-100
  reasons: string[];                // e.g., ["2 EMIs missed in 90 days"]
  recommendedIntervention: string;
  empatheticMessage: string;        // LLM-generated, plain language
}

interface AuditEntry {
  timestamp: Date;
  customerId: string;
  action: string;                   // e.g., "recommend_product", "detect_stress"
  dataAccessed: string[];           // e.g., ["transactions", "spend_categories"]
  consentVerified: boolean;
  decision: string;
  reasonTrace: string[];
}
```

---

## 7. API Endpoints (Next.js API Routes)

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/customers/[id]` | Customer profile + consent state |
| GET | `/api/customers/[id]/signals` | Computed signals |
| GET | `/api/customers/[id]/recommendations` | Orchestrator-generated recommendations with reason traces |
| GET | `/api/customers/[id]/wellness` | Stress/anomaly status + intervention message |
| POST | `/api/chat/[customerId]` | Vernacular conversational turn (body: `{message, language}`) |
| GET | `/api/customers/[id]/audit-log` | Audit log of AI decisions/data accessed |
| POST | `/api/consent/[customerId]` | Update consent flags |

---

## 8. Frontend Screens (React)

1. **Dashboard** — Customer picker (dropdown of personas for demo), income/spend timeline chart, recommendation feed with expandable "Why?" cards, wellness score gauge with color coding (🟢🟡🔴).
2. **Chat Widget** — Floating/panel chat, language toggle (EN/HI), voice input button (mic icon), used for the onboarding-journey demo.
3. **Consent & Compliance Panel** — Toggle switches per data category, audit log table showing what AI accessed and when, DPDP Act alignment notes.
4. **(P2) Persona Switcher / Demo Mode** — Hidden dev toggle to jump to each persona's pre-seeded state for smooth live demo.

---

## 9. Synthetic Data Strategy

### Demo Personas (3 primary, mapped 1:1 to challenge points)

| Persona | Life Stage | Monthly Income | Key Patterns | Demo Story | Challenge Addressed |
|---|---|---|---|---|---|
| **Priya Sharma, 27** | EARLY_CAREER, Tier-3 salaried teacher | ₹45,000 | Regular salary, disciplined saver, no active loan, Swiggy/Zomato spend | Show: salary credit detected → savings rate signal → proactive RD/SIP recommendation with "Why" card | **Challenge 1**: Smart Recommendation |
| **Ramesh Kumar, 34** | GIG_WORKER, irregular income driver | ₹25,000-40,000 (variable) | Spiky UPI inflows, no fixed salary date, occasional missed bills | Show: Hindi voice chat → guided loan application → simplified KYC conversation → flexible repayment recommendation | **Challenge 2**: Vernacular Onboarding |
| **Sunita Devi, 41** | STRESSED, small shop owner | ₹30,000 (declining) | 2 missed EMIs, sudden drop in daily UPI inflow, increased cash withdrawals | Show: wellness score dropping → empathetic check-in → Wellness Gate visibly suppressing loan offer → restructuring option instead | **Challenge 3**: Stress Detection + Wellness Gate |

### Additional Personas (background data, 10-12 more)
- Early career professionals with salary hikes
- Newly married with wedding spending patterns
- Pre-retirement with education payments
- Rural farmers with seasonal income
- Mix of demographics to show no algorithmic bias

### Transaction Data Specs
- 6 months of transaction history per persona
- Mix of: UPI, NEFT, IMPS, ATM, POS, EMI debits, salary credits
- Realistic Indian merchant names (Swiggy, BigBazaar, Reliance Fresh, Jio Recharge, LIC Premium)
- Embedded patterns that signal extraction will detect
- Festival-season spending bumps, seasonal income patterns

---

## 10. Agent Orchestrator Design

### System Prompt Principles (write actual prompt in code — this is the spec):

1. **"You are a decision *narrator*, not a decision *maker*, for anything financial."** Always call a tool to get the underlying determination; your job is to explain it in plain, empathetic language.
2. **Always call `checkConsent()` before calling `getCustomerSignals()`.** Never access data without verified consent.
3. **Never suggest a credit product without first calling `wellnessGateCheck()`.** This is non-negotiable.
4. **When explaining a recommendation**, use the `reasonTrace` from the tool output — do not invent reasons.
5. **For stressed customers**, use empathetic, non-judgmental language. Frame interventions as support, not punishment.
6. **For vernacular interactions**, keep banking terminology simple. Explain concepts like EMI, interest rate, SIP in everyday language.

---

## 11. Demo Script (aim for 4 minutes)

### Minute 0:00-0:30 — The Problem (Emotional Hook)
> "Meet Sunita Devi. She runs a small shop in a Tier-3 town. She has a bank account, but her banking app pushes credit card offers in English while she's struggling to pay last month's EMI. DhanSathi changes that."

### Minute 0:30-1:30 — Priya: Smart Recommendation (Challenge 1)
- Show Priya's dashboard: income/spend chart, computed signals visible
- Show recommendation: "Based on your consistent savings of ₹8,000/month and stable salary, consider a Recurring Deposit"
- Click "Why this recommendation?" → Show expandable card with reason trace: `savings_rate = 0.32 > 0.2 threshold`, `salary_regularity = 0.95`, `no active loan`
- **Key message**: "Every recommendation traces back to specific, auditable signals — not LLM intuition."

### Minute 1:30-2:30 — Ramesh: Vernacular Chat (Challenge 2)
- Switch to chat widget, toggle to Hindi
- **Voice**: "Mujhe loan chahiye gaadi khareedne ke liye" (I need a loan to buy a vehicle)
- DhanSathi responds in Hindi, asks about income type, guides through application
- Show: Real-time voice → text, Hindi response, simplified financial terms
- **Key message**: "500M+ Indians are more comfortable in their own language. DhanSathi speaks theirs."

### Minute 2:30-3:30 — Sunita: Wellness Gate (Challenge 3)
- Switch to Sunita's dashboard: wellness score at 35 (🔴)
- Show stress reasons: "2 EMIs missed in 90 days", "savings below safety threshold"
- Show empathetic message: "We noticed things have been tight. Would you like to explore restructuring your EMI to reduce the monthly burden?"
- **Key demo moment**: Show that a loan offer is **visibly suppressed** by the Wellness Gate — "This customer would normally qualify for a credit card offer, but the Wellness Gate blocked it because she's financially stressed."
- **Key message**: "DhanSathi doesn't just personalize — it protects."

### Minute 3:30-4:00 — Architecture & Close
- Flash architecture diagram (the one above)
- Show consent panel with audit log
- Close: "Every decision is explainable, consent-verified, and auditable. We built compliance INTO the system, not onto a slide."

---

## 12. Presentation Strategy (8-10 slides)

1. **Title**: DhanSathi — AI-Powered Hyper-Personalized Banking for Bharat
2. **The Problem**: Emotional story hook — generic banking failing Tier 2/3/4 India (1 slide, 30s)
3. **Our Insight**: "Agentic AI with deterministic accountability" — LLM narrates, code decides (1 slide, 30s)
4. **Architecture**: Tool-calling diagram, Signal Extraction → Orchestrator → Deterministic Tools → Wellness Gate (1 slide, 30s)
5. **Live Demo**: Priya → Ramesh → Sunita walkthrough (3-4 minutes, see demo script)
6. **AI/ML Approach**: How each tool works, Gemini integration, why rule-based stress detection is an intentional design choice (1 slide, 30s)
7. **Ethical Safeguards**: Wellness Gate demo moment, Consent Ledger panel, DPDP Act alignment, anti-predatory design (1 slide, 30s)
8. **Impact & Scalability**: 500M+ potential users, modular architecture ready for service extraction, bank API integration path (1 slide, 30s)
9. **Team**: What we built in 36 hours with 3 people (1 slide, 15s)

### Presentation Tips
- Lead with EMOTION (Sunita's story), not tech
- Show the AI reasoning chain live — judges love transparency
- Emphasize what you DIDN'T do (anti-predatory Wellness Gate) as much as what you did
- When a judge asks "what stops the AI from pushing loans?", answer: "Deterministic code, not a prompt" and point to the Wellness Gate
- Before final rehearsal, walk the judging criteria table and make sure you can point to a specific screen or code path for each row — that's the actual win condition

---

## 13. Explainability & Compliance Design

- **DPDP Act alignment**: Explicit, granular consent per data category (not one blanket toggle); visible purpose-limitation statement; user-facing audit log of what AI accessed.
- **RBI data-localization note**: State in compliance one-pager that all data processing is designed to occur within India-hosted infrastructure in production (design note, not provisioned in 36 hours).
- **Avoiding predatory nudging**: The Wellness Gate (Feature 9) is the concrete mechanism. Document it in both this file and the ADR as the primary anti-predatory control.
- **Algorithmic bias**: Recommendation logic uses interpretable signals/rules specifically because rule-based logic is auditable for bias in a way an opaque model isn't. Mention the stretch fairness check as a further step.
- **Explainability**: Every determination returns a `reasonTrace` — specific signals and thresholds, not a bare confidence score or LLM prose. This is decided at the data-shape level from day 1.

---

## 14. 36-Hour Execution Plan

| Hours | Focus | Member 1 | Member 2 | Member 3 |
|---|---|---|---|---|
| 0-3 | Data + scaffolding | Data generator (Feature 1) | Project scaffolding + UI shell (Feature 2) | Signal extraction layer (Feature 3) |
| 3-8 | Core engine + dashboard | Data generator polish + review | Dashboard v1 (Feature 6) | Recommendation engine + orchestrator (Feature 4+5) |
| 8-14 | **End-to-end P0 slice working** | Integration testing | Dashboard wired to API | Reason traces + end-to-end flow |
| 14-18 | Vernacular + stress | Vernacular chatbot (Feature 7) | Loan journey flow | Stress detection module (Feature 8) |
| 18-22 | Voice + wellness gate | Voice input/output (Web Speech API) | Consent panel UI (Feature 10) | Wellness Gate + audit logger (Feature 9) |
| 22-28 | Persona seeding + rehearsal | Demo storyline data (Feature 11) | Persona switcher UI | Polish all agent flows |
| 28-32 | Polish + compliance | Architecture diagram + compliance doc (Feature 13) | UI polish + animations | Cached response fallback + bug fixes |
| 32-34 | Deploy + rehearse | Deploy to Vercel (Feature 14) | Demo rehearsal × 3 | Demo rehearsal × 3 |
| 34-36 | Buffer / stretch / final rehearsal | Stretch: extra languages | Stretch: admin view | Stretch: fairness check |

**Rule of thumb**: If behind schedule at hour 14, cut from P2/P3 first. Never cut the Wellness Gate (Feature 9) — it's the cheapest, highest-leverage feature for the rubric.

---

## 15. Technical Stack

| Layer | Technology | Why This Choice |
|---|---|---|
| **Framework** | Next.js 14+ (App Router, TypeScript) | Full-stack in one framework, SSR, team's strength |
| **Styling** | Tailwind CSS + Framer Motion | Rapid UI development, beautiful animations for demo wow-factor |
| **AI/LLM** | Google Gemini 2.0 Flash / Pro | Team has API access, excellent multilingual support, function calling |
| **Agent Orchestration** | Custom lightweight TypeScript orchestrator | Full control, transparent code judges can inspect, no framework bloat |
| **Voice** | Web Speech API (browser-native) | Zero dependency, zero cost, supports Indian languages |
| **Database** | SQLite or JSON files for demo | Zero setup overhead. Document production path (Postgres + feature store) in ADR |
| **Deployment** | Vercel (free tier) | One-click deploy, automatic HTTPS, native Next.js support |
| **Charts** | Recharts | Beautiful financial charts for dashboard |

---

## 16. Risk Mitigation

| Risk | Probability | Mitigation |
|---|---|---|
| **Gemini API rate limits / flakiness during demo** | Medium | Cache the exact API responses for the 3 rehearsed demo personas. If live call fails, serve cached response silently. Never let a network hiccup kill your demo. |
| **Demo failure during presentation** | Low | Rehearse 3+ times. Have cached fallback (invisible to judges). Pre-seeded persona data guarantees predictable flow. |
| **Voice API browser compatibility** | Medium | Test on Chrome (best support). Always have text input as visible fallback. |
| **Running out of time** | High | P0 features scoped for 14 hours. P1 features independent — can be dropped without breaking demo. Wellness Gate is only ~1 hour but has outsized impact — never cut it. |
| **Orchestrator behaving unpredictably** | Medium | Every tool is independently testable via a raw API call. If LLM phrasing is imperfect on stage, you can show "the underlying logic is correct" via the reason trace. |
| **Team member burnout** | Medium | 8-hour sleep rotation, clear ownership, no scope creep after hour 20. |
| **Judge asks "how would this scale?"** | High | Prepare the modular monolith → microservices narrative from ADR-005. Clear seams to split along. One-paragraph answer rehearsed. |
| **Judge asks "did you train a model?"** | High | Honest answer: "Intentional design choice — rule-based stress detection is more explainable and auditable than an ML model trained on synthetic data we generated ourselves." Judges respect this. |

---

## 17. Self-Check Against the Judging Rubric

Before your final rehearsal, walk this table out loud and make sure you can point to a specific screen or code path for each row — that's the actual win condition.

| Judging Criterion | Primary Feature(s) Answering It | Can You Demo It Live? |
|---|---|---|
| Innovation & technical feasibility | Agentic orchestrator + tool-calling (Feature 4) | ✅ Show orchestrator calling tools, show function-calling logs |
| Depth of personalization vs. genuine benefit | Wellness Gate (Feature 9) + Reason Traces (Feature 5) | ✅ Show loan offer suppressed for Sunita, show "Why" cards for Priya |
| Explainability & RBI/regulatory compliance | Reason Traces (Feature 5) + Consent Ledger (Feature 10) | ✅ Show audit log, show consent toggles, show reason traces |
| Usability for vernacular-first users | Vernacular Chat (Feature 7) + Voice + Dashboard (Feature 6) | ✅ Live Hindi voice conversation with Ramesh |
| Scalability & social/financial impact | Architecture design + ADR scalability narrative | ✅ Show architecture diagram, explain modular monolith → services path |

---

## 18. What Makes This a WINNING Solution

1. **Agentic AI with Deterministic Accountability**: Not a "ChatGPT wrapper" — real tool-calling with auditable, deterministic financial logic.
2. **Wellness Gate**: A concrete, demoable mechanism that PROVES we're not just upselling. Cheapest feature, highest ROI.
3. **Reason Traces Everywhere**: Every AI decision is traceable to specific signals and thresholds. No black boxes.
4. **Consent Ledger as Working UI**: While other teams mention DPDP in a slide, we have a working panel.
5. **Vernacular Voice**: A live Hindi voice demo is a showstopper moment no other team will match.
6. **Honest Design Choices**: Rule-based stress detection is framed as intentional (explainability-first), not as a shortcut. Judges respect honesty.
7. **Full-Stack Polish**: Beautiful UI that looks like a real product, not a hackathon project.
8. **Emotional Storytelling**: We don't just show tech — we show Sunita being protected, Ramesh being included, Priya being empowered.

---

> **Remember**: Hackathons are won on **demo quality** and **narrative clarity**, not code completeness. A polished demo of 5 features beats a buggy demo of 15 features every time. Focus on the story, make it emotional, make it work flawlessly. Before your final rehearsal, walk the judging rubric table and make sure every row has a live, demoable answer.

---

## 19. Phase 2 Features — Winning Edge (Post P0+P1 Completion)

> Features 1-10 (P0 Spine + P1 Differentiators) are complete. The following features are classified by priority based on their **direct mapping to problem statement text** and **what competing teams will miss**.

### P1-Critical — Problem Statement Required (Most Teams Will Miss)

These features address **explicit words in the problem statement** that judges will look for.

| Order | Feature | Time | Problem Statement Text | Impact |
|-------|---------|------|----------------------|--------|
| **11** | **LLM Guardrail Suite** | 1.5h | "ethical safeguards" (deliverable) | 🔴 CRITICAL — Prompt injection shield + output schema validator + financial accuracy guard. 99% of teams have zero LLM safety. |
| **12** | **Agentic Eval Suite** | 1.5h | "technical feasibility" (judging) | 🔴 CRITICAL — 12+ automated assertions verifying the entire pipeline. "Let me run our test suite live" = mic drop. |
| **13** | **Contextual Timing Engine** | 1.5h | "at the **right moment**" (Challenge 1) | 🔴 CRITICAL — Adds "when" intelligence to recommendations. Most teams only answer "what." |
| **14** | **Guided Loan Journey Flow** | 2h | "**loan journey**" (deliverable), "loan application, **KYC**" (Challenge 2) | 🔴 CRITICAL — Multi-step loan application via chatbot with progress tracking. Literally a named deliverable. |
| **15** | **Fraud/Anomaly Detection** | 1.5h | "**fraud**", "unusual transaction patterns", "sudden **behavior change**" (Challenge 3) | 🔴 CRITICAL — We address stress but NOT fraud. The problem explicitly says both. |
| **26** | **RiskNet — From-Scratch ML Risk Model** | 2h | "innovation & technical feasibility" (judging) | 🔴 CRITICAL — Logistic regression built from scratch in pure TS (no ML libs): data prep → train → LOCO-CV → inference → per-prediction attributions. The model's weights are readable and shown in the UI. Advisory-only (ADR-022). |

### P2 — High Impact Quick Wins

| Order | Feature | Time | Why Essential | Impact |
|-------|---------|------|--------------|--------|
| **16** | **RBI Compliance & Data Localization Page** | 30m | "**RBI data localization norms**" (deliverable) | 🟠 HIGH — A `/compliance` page in the app. Most teams put this on a slide. |
| **17** | **Behavioral Segmentation Display** | 45m | "**behavioral segmentation**" (deliverable) | 🟠 HIGH — Named behavioral segments from transaction patterns. Explicitly in deliverables. |
| **18** | **PII Redaction Layer** | 45m | "data **privacy** and consent" (deliverable) | 🟠 HIGH — Defense-in-depth: LLM never sees raw Aadhaar/PAN even with consent granted. |
| **19** | **Proactive Next-Best-Action System** | 1h | "**proactively** recommend" (Challenge 1) | 🟠 HIGH — Action banner at top of dashboard. Transforms passive dashboard into proactive assistant. |
| **20** | **Response Caching & Demo Hardening** | 1h | Demo reliability | 🟠 HIGH — Pre-warm caches for personas. Guarantees sub-second load + demo never fails. |
| **21** | **Vercel Deployment** | 1h | "Vercel free tier" (team constraints) | 🟠 HIGH — Live URL >>> localhost. Cached fallback for offline demo. |
| **22** | **Multi-Language Beyond Hindi** | 30m | "Hindi, **Tamil, Telugu**, etc." (Challenge 2) | 🟡 MEDIUM — Trivial to add (Gemini supports natively). Shows Bharat-wide thinking. |

### P3 — Polish & Proof Points

| Order | Feature | Time | Why Useful | Impact |
|-------|---------|------|-----------|--------|
| **23** | **Observability & Tracing Dashboard** | 1h | Shows production engineering maturity | 🟡 MEDIUM — `/admin/traces` with LLM call logs, latency, token usage. |
| **24** | **Architecture Visualization Page** | 45m | Deliverable: "architecture/flow diagram" | 🟡 MEDIUM — Interactive Mermaid diagram IN the app. |
| **25** | **Recommendation Fairness Audit** | 45m | "algorithmic **bias**" (deliverable) | 🟡 MEDIUM — Post-hoc bias check. Generates a fairness report. |

---

## 20. Phase 2 Tool Specifications

### Tool 6: ⏰ `computeTimingSignals(customerId)` — Contextual Timing Engine
**Type**: Deterministic TypeScript
**Role**: Computes the optimal moment to surface a recommendation.

**Rules**:
- Salary just credited (within 48h) → Recommend savings products (momentum)
- Festival season approaching (Diwali, Eid, Pongal) → Short-term savings
- EMI due in 3 days + low balance → Proactive alert (stress prevention)
- 3+ months of stable savings → Investment upgrade
- Recent large expense category shift → Financial check-in

**Output**:
```typescript
{
  trigger: "salary_credited_recently",
  urgency: "now" | "soon" | "scheduled",
  reason: "Salary of ₹35,000 credited 2 days ago. Savings momentum is high."
}
```

### Tool 7: 🔍 `detectAnomalies(customerId)` — Fraud/Anomaly Detection
**Type**: Deterministic rule + statistical engine
**Role**: Detects unusual transaction patterns indicative of fraud or account takeover.

**5 Detection Rules**:
1. **Unusual Merchant**: Transaction to never-seen merchant + amount > 2× average
2. **Sudden Large Withdrawal**: ATM > 50% of monthly income in single txn
3. **Frequency Spike**: >3× normal daily transaction count
4. **Category Shift**: Spend distribution changed >40% month-over-month
5. **Velocity Check**: Multiple high-value transactions within 1 hour

**Output**:
```typescript
{
  anomalies: [{ type, severity, description, transaction }],
  overallRiskScore: number  // 0-100
}
```

### Tool 9: 🧠 `predictRiskScore(customerId)` — RiskNet ML Risk Model (Feature 26, ADR-022)
**Type**: From-scratch logistic regression, pure TypeScript (no ML libraries)
**Role**: Predicts next-month EMI-miss probability from this month's transaction features. **Advisory-only** — the deterministic rule engine always makes the final call.

**Pipeline (all hand-built)**:
1. **Data prep**: customer-month rows from `transactions.json`; strict month-m → month-(m+1) label split (no leakage)
2. **Train**: batch gradient descent + L2 + standardization, fixed iterations (deterministic, bit-identical artifacts)
3. **Evaluate**: leave-one-customer-out CV (accuracy/precision/recall/AUC) stored in the committed artifact
4. **Infer**: dot product against `src/data/risk-model.json`; sigmoid → probability
5. **Explain**: top attribution factors = `weight_i × standardized x_i` (sums exactly to the logit)

**Output**:
```typescript
{
  probability: 0.73,             // P(EMI missed next month)
  riskBand: "high",              // low < 0.33 ≤ medium < 0.66 ≤ high
  topFactors: [
    { feature: "savingsRate", contribution: 1.42, description: "Savings rate dropped well below your usual level" }
  ],
  modelVersion: "risknet-1.0"
}
```

**Guardrails**: experimental label; never used for compliance decisions; never flips `isAtRisk` or overrides wellness scores; consent-gated (transactions) + audited.

### Tool 10: 🛡️ Guardrail Pipeline
**Type**: Deterministic validation layer
**Position**: Wraps ALL LLM calls.

**Three Guards**:
1. **Prompt Injection Shield**: Regex + keyword detection for injection patterns
2. **Output Schema Validator**: Validates LLM output conforms to expected schemas
3. **Financial Accuracy Guard**: Ensures LLM narrations don't contain hallucinated financial data (interest rates, EMI amounts) not from tool output

---

## 21. Recommended Parallelized Implementation Schedule

| Time Block | Member 1 | Member 2 | Member 3 |
|-----------|----------|----------|----------|
| **Hour 1** | Feature 11: Guardrail Suite | Feature 12: Eval Suite | Feature 13: Timing Engine |
| **Hour 2** | Feature 14: Loan Journey (start) | Feature 15: Fraud Detection | Feature 16: RBI Compliance Page |
| **Hour 3** | Feature 14: Loan Journey (finish) | Feature 17: Behavioral Segmentation | Feature 18: PII Redaction |
| **Hour 4** | Feature 19: Next-Best-Action | Feature 20: Response Caching | Feature 21: Vercel Deployment |
| **Hour 5** | Feature 22: Multi-Language | Feature 23: Observability | Feature 24: Architecture Page |
| **Hour 6** | Feature 25: Fairness Audit | Integration testing | Demo rehearsal |

---

## 22. Updated Self-Check Against Judging Rubric (Phase 2)

| Judging Criterion | Phase 1 Features | Phase 2 Additions | Gap Closed? |
|---|---|---|---|
| Innovation & technical feasibility | Agentic orchestrator + tool-calling | Guardrails, Eval Suite, Timing Engine, **RiskNet (from-scratch ML with attribution)** | ✅ Fully covered — hand-built ML pipeline: data prep → train → CV → inference → explain |
| Depth of personalization vs. genuine benefit | Wellness Gate + Reason Traces | Timing ("right moment"), Next-Best-Action, Behavioral Segmentation | ✅ "What + When + Why" trifecta |
| Explainability & RBI/regulatory compliance | Reason Traces + Consent Ledger | RBI Compliance Page, Fairness Audit, PII Redaction | ✅ Compliance at every layer |
| Usability for vernacular-first users | Vernacular Chat + Voice | Multi-Language (Tamil, Telugu), Guided Loan Journey | ✅ Beyond Hindi, beyond chat |
| Scalability & social/financial impact | Architecture design | Observability, Response Caching, Vercel Deployment | ✅ Production-ready signals |

