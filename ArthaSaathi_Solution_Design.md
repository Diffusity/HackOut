# ArthaSaathi — AI-Powered Hyper-Personalized Banking for Bharat
### Solution Design Document (Hackathon Build Spec)

> **Document purpose**: This file is the single source of truth for what to build, why, and in what order. It is written so that a human teammate *or* an AI coding agent picking this up cold can understand the full context and start implementing without needing the original problem-statement image. A companion `ADR.md` in this repo captures the architectural decisions and their trade-offs.

---

## 0. Problem Statement (verbatim context, for grounding)

**Theme**: Digital Transformation in Lending
**Title**: AI-Powered Hyper-Personalized Banking for Bharat

**Background**: Indian banks have strong digital rails (UPI, net banking, video KYC) but the experience is generic and disconnected from actual customer needs, especially in Tier 2/3/4 towns and rural India. Banks face high customer-acquisition cost, high drop-off in loan/product journeys, and poor cross-sell — largely because they treat all customers the same despite having rich transactional/behavioral data.

**Challenge — design an AI solution that can:**
1. Analyze transaction history, spending patterns, and life-stage signals (salary credits, EMI patterns, savings behavior) to proactively recommend the *right* banking product at the *right* moment — not generic pop-ups.
2. Simplify and personalize the digital banking journey (onboarding, loan application, KYC) using conversational AI/chatbots in **vernacular languages**, reducing drop-off for first-time digital users.
3. Detect early warning signals of financial stress or fraud (unusual transactions, missed EMIs, sudden behavior change) and trigger **proactive, empathetic interventions** — not punitive actions like immediate default flags.

**Deliverables expected**: architecture/flow diagram, a working prototype/wireframe of the customer journey, an explanation of the AI/ML approach, and a note on ethical safeguards (DPDP Act, RBI data localization, algorithmic bias, avoiding predatory nudging).

**Judging criteria**: innovation & technical feasibility · depth of personalization vs. genuine customer benefit (not just upsell) · explainability & RBI/regulatory compliance readiness · usability for non-tech-savvy/vernacular-first users · scalability across a bank's existing digital infrastructure and social/financial impact.

**Team constraints for this build**: ~36-hour hackathon, 2–3 engineers, stack = **Python (FastAPI) backend + React frontend**. Team's strongest muscles: full-stack development, agentic AI orchestration, GenAI/transformers, and foundational (not deep specialist) ML.

---

## 1. Why This Strategy Maximizes Your Chances (read this first)

No document can *guarantee* a win — judging panels vary — but the judging rubric above tells you almost exactly what to optimize for, and it rewards things your team is already strong at. Here's the read:

- **Most competing teams will build**: a recommendation dashboard using a generic collaborative-filtering pitch, a chatbot that's really just a wrapped LLM prompt, and a slide claiming "we use ML for fraud detection" with no real logic behind it. This satisfies "innovation" weakly and completely fails "explainability" and "avoiding predatory nudging."
- **Your differentiators, mapped directly to judging criteria**:
  - *Innovation & technical feasibility* → an **agentic orchestrator with real tool-calling** (not prompt-chaining theatre) is a genuinely more sophisticated pattern than most student/hackathon teams implement, and it's exactly your team's strength.
  - *Depth of personalization vs. genuine benefit* → the **Wellness Gate** (Section 4, Feature 9) is a concrete, demoable mechanism that proves you're not just upselling — this is the single highest-leverage feature for this specific criterion.
  - *Explainability & compliance readiness* → every recommendation and every stress alert carries a **human-readable reason trace** and a **Consent Ledger** mapped to DPDP Act principles. This is cheap to build and disproportionately impresses judges because almost no one does it.
  - *Usability for vernacular-first users* → a live bilingual (English + Hindi) conversational onboarding demo is highly visual and memorable in a live judging round.
  - *Scalability* → addressed narratively via the ADR (modular monolith today, clear seams to split into services later) rather than over-engineered infra you won't have time to build.
- **The core insight**: in a 36-hour hackathon, judges are scoring a **demo + narrative**, not a production system. Depth should go into the 3–4 features that are visibly demoable and map 1:1 to rubric line items — not into infrastructure no one will see.

---

## 2. Product Concept — "ArthaSaathi"

**One-line pitch**: *ArthaSaathi ("wealth companion") is an agentic AI layer that sits on top of a bank's existing transaction data, quietly watches for the right moment to help — a product recommendation, a simplified vernacular onboarding step, or a caring check-in — and never nudges a customer who's already financially stressed.*

**Why this name/framing**: "Saathi" (companion, Hindi) signals the vernacular-first, non-predatory positioning in the name itself — useful in a live pitch.

### Demo personas (build 3 seeded synthetic customers — see Section 5)
1. **Meera, 27, Tier-3 town, salaried school teacher** — regular salary credit, disciplined saver, no active loan → good candidate for a recurring-deposit / micro-investment nudge at the right moment (just after salary credit, once a cushion exists).
2. **Ramesh, 34, gig-economy driver, irregular income** — spiky UPI inflows, no fixed salary date, occasional missed bill payments → good candidate for the **vernacular onboarding assistant** (first-time digital loan applicant) and a **flexible-repayment product recommendation** instead of a rigid EMI.
3. **Sunita, 41, small shop owner, recently missed 2 EMIs** — sudden drop in daily UPI inflow, EMI payment delayed twice → good candidate to demonstrate the **stress-detection + empathetic intervention + Wellness Gate suppressing new loan offers** end-to-end.

These three personas let you demo all three challenge points in under 4 minutes without needing real bank data.

---

## 3. System Architecture

```
                        ┌─────────────────────────────────────────────┐
                        │              DATA SOURCES (synthetic)         │
                        │  Salary credits · UPI/txn history · EMI       │
                        │  schedule · KYC/profile · consent flags       │
                        └───────────────────────┬───────────────────────┘
                                                 │
                                  ┌──────────────▼───────────────┐
                                  │   SIGNAL EXTRACTION LAYER     │
                                  │ (deterministic Python service)│
                                  │ salary regularity, savings    │
                                  │ rate, EMI-miss count, spend    │
                                  │ volatility, life-stage tags    │
                                  └──────────────┬───────────────┘
                                                 │
                        ┌────────────────────────▼────────────────────────┐
                        │           AGENT ORCHESTRATOR (LLM, tool-use)      │
                        │  Reads signals → decides which tool(s) to call    │
                        │  → composes an explainable, consent-checked       │
                        │    response                                       │
                        └───┬───────────┬───────────┬───────────┬──────────┘
                            │           │           │           │
                 ┌──────────▼──┐ ┌──────▼─────┐ ┌───▼────────┐ ┌▼───────────────┐
                 │Recommendation│ │Stress/Risk │ │Consent     │ │Vernacular       │
                 │Tool          │ │Tool        │ │Ledger Tool │ │Conversation Tool│
                 │(deterministic│ │(rule +     │ │(policy     │ │(LLM NLU/NLG,    │
                 │ scoring +    │ │ statistical│ │ check)     │ │ Hindi+English)  │
                 │ LLM narrative)│ │ engine)   │ │            │ │                 │
                 └──────────┬──┘ └──────┬─────┘ └───┬────────┘ └┬───────────────┘
                            │           │           │            │
                            └─────┬─────┴─────┬─────┴────────────┘
                                  │           │
                       ┌──────────▼───┐ ┌─────▼──────────┐
                       │  WELLNESS GATE│ │  AUDIT/REASON   │
                       │  (hard rule,  │ │  TRACE LOGGER   │
                       │  not LLM)     │ │                 │
                       └──────────┬───┘ └─────┬───────────┘
                                  │           │
                        ┌─────────▼───────────▼─────────┐
                        │        FASTAPI REST API         │
                        └─────────┬────────────┬──────────┘
                                  │            │
                     ┌────────────▼──┐   ┌─────▼───────────────┐
                     │ React Dashboard│   │ React Chat Widget    │
                     │ (Customer 360, │   │ (vernacular onboarding│
                     │  "why" cards,  │   │  + loan journey)      │
                     │  consent panel)│   │                       │
                     └────────────────┘   └───────────────────────┘
```

**Key architectural choice**: the orchestrator is an LLM using **tool-calling/function-calling**, but the tools it calls are mostly **deterministic Python code**, not more LLM calls. Only the vernacular conversation tool is itself LLM-backed. This hybrid is deliberate — see `ADR-001` — because a fully black-box LLM pipeline fails the "explainability" judging criterion, while a fully deterministic pipeline fails "innovation."

---

## 4. Feature List — Priority, Rationale, Exclusions, Impact

Each feature below states: **what it does**, **why it's included** (tied to a judging criterion or persona), **why the more obvious alternative was rejected**, **demo impact**, and **priority tier**. Build strictly in tier order: **P0 → P1 → P2 → P3**. Do not start P1 work until all P0 features have a working end-to-end path, even a rough one — a thin end-to-end slice beats a polished but disconnected feature every time in a live demo.

### P0 — Core spine (build first, ~14–16 hours; this must work end-to-end before anything else)

**1. Synthetic Banking Data Generator**
- *What*: A Python script that generates realistic transaction histories, salary credit patterns, EMI schedules, and KYC profiles for ~15–20 synthetic customers (including the 3 named personas), stored as JSON/SQLite.
- *Why included*: There is no real bank data available, and judges know this — a believable, clearly-labeled synthetic dataset with realistic Indian banking patterns (UPI micro-transactions, monthly salary spikes, EMI debit dates, festival-season spend bumps) is itself evidence of domain understanding.
- *Why not real/public data*: No compliant public dataset matches Indian transaction-level behavior at this granularity; using one would also weaken the "designed for Bharat" narrative.
- *Impact*: Without this, nothing else works — it's the foundation every other feature reads from.
- *Priority*: P0, build first (~2 hours).

**2. Signal Extraction / Feature Engineering Service**
- *What*: Deterministic functions that turn raw transactions into interpretable signals: `salary_regularity_score`, `savings_rate`, `emi_miss_count`, `spend_volatility_30d`, `income_type` (salaried/gig/self-employed), `life_stage_tags`.
- *Why included*: This is the "basic ML/fundamentals" layer the team is confident in, and it's what makes every downstream recommendation *explainable in plain numbers* rather than a mystery embedding.
- *Why not a learned embedding model*: No time to train, no labeled data, and embeddings are not explainable to a non-technical judge or a regulator — directly hurts the compliance criterion.
- *Impact*: Feeds both the recommendation and stress-detection tools; also the direct source of every "why" explanation shown to the user.
- *Priority*: P0 (~2–3 hours).

**3. Agentic Recommendation Engine (Orchestrator + Recommendation Tool)**
- *What*: The orchestrator LLM receives a customer's signals, decides which product category is relevant (savings/investment, credit, insurance, flexible loan), calls the deterministic `recommend_product(signals)` scoring function, then uses the LLM only to phrase the *why* narrative in plain language.
- *Why included*: This is the single highest-signal "innovation & technical feasibility" feature — real tool-calling agentic design, not a hardcoded if/else pretending to be AI, and not a naked LLM prompt pretending to be principled.
- *Why not pure collaborative filtering*: No user-item interaction history exists in a hackathon dataset large enough to make CF meaningful; scoring off interpretable signals is both more honest and more explainable.
- *Why not a single giant LLM prompt with no tools*: Judges increasingly recognize "ChatGPT wrapper" solutions; a tool-use architecture demonstrates real engineering and gives you a defensible answer when asked "how does it actually work."
- *Impact*: This is your headline feature — leads the demo.
- *Priority*: P0 (~4–5 hours).

**4. Explainable "Why This" Reasoning Layer**
- *What*: Every recommendation and every alert is returned as a structured object: `{decision, confidence, reason_trace: [signal → threshold → conclusion], plain_language_explanation}`. The frontend renders this as a small expandable "Why am I seeing this?" card.
- *Why included*: Directly answers the "explainability and RBI/regulatory compliance readiness" criterion — this is close to what an actual bank compliance/audit team would ask for.
- *Why not just a confidence score*: A bare number ("87% match") is not explainable and reads as a black box to a judge.
- *Impact*: Cheap to build (mostly a data-shape decision made early), disproportionately high judging impact.
- *Priority*: P0 (~1–2 hours, mostly designed into Feature 3's output shape from the start).

**5. Customer 360 React Dashboard**
- *What*: A single-page dashboard: customer summary card, income/spend timeline chart, active recommendations feed with "why" cards, and a "financial wellness" indicator.
- *Why included*: Judging is a live demo — you need a visual home base to walk through personas 1–3. This is the "working prototype/wireframe" deliverable explicitly asked for.
- *Why not a CLI or Postman demo*: Explicitly weaker for a live judging round with non-technical judges scoring on usability.
- *Impact*: Primary demo surface.
- *Priority*: P0 (~4–5 hours).

### P1 — Differentiators (next ~10–12 hours)

**6. Vernacular Conversational Onboarding Assistant**
- *What*: A chat widget (React) backed by the LLM directly (no fine-tuning) that walks a first-time digital user (persona: Ramesh) through a simplified loan-application/KYC conversation in **Hindi and English**, switchable mid-conversation.
- *Why included*: Directly targets "usability for non-tech-savvy and vernacular-first users" — the most visually memorable feature in a live demo when a judge sees a natural Hindi conversation instead of a form.
- *Why not a custom-trained vernacular NLU model*: No time or data to fine-tune in 36 hours; modern general-purpose LLMs already handle Hindi (and code-mixed Hinglish) well, so building a custom model would be reinventing something the base model already does, at high risk and no added judge-visible value.
- *Impact*: High — visually distinctive, directly demoable, cheap given the team's GenAI strength.
- *Priority*: P1 (~4–5 hours).

**7. Financial Stress & Anomaly Detection Module**
- *What*: A deterministic rule + statistical engine (rolling-window z-score on spend/inflow, missed-EMI counter, sudden category-shift detector) that flags a customer as "at risk," then hands the flag to the LLM *only* to phrase an empathetic, non-judgmental message — never to make the stress determination itself.
- *Why included*: Directly implements challenge point 3 ("detect early warning signals... trigger proactive, empathetic interventions rather than purely punitive actions").
- *Why not a trained anomaly-detection ML model (e.g., isolation forest, autoencoder)*: With only synthetic data and no real fraud/default labels, a "trained" model would be fitting noise and cannot be honestly validated — worse for explainability and honesty with judges than a transparent rule engine. State this trade-off openly in the demo; judges respect the honesty.
- *Impact*: Second headline feature — pairs directly with Feature 9 (Wellness Gate) for the "genuine benefit vs. upsell" criterion.
- *Priority*: P1 (~3–4 hours).

**8. Consent Ledger & Data Privacy Panel**
- *What*: A visible panel showing, per customer, which data categories they've consented to for personalization (transaction history, location, spend categories), with an audit log of what the AI accessed and when — framed against DPDP Act (Digital Personal Data Protection Act) principles and RBI data-localization language.
- *Why included*: This is the cheapest possible way to fully satisfy the explicit "ethical safeguards" deliverable and the "explainability/compliance readiness" judging criterion — most teams will only mention this in a slide; you'll have it as a working UI panel.
- *Why not just a compliance slide*: A working panel is more credible and differentiates you the moment a judge asks "can I actually see this."
- *Impact*: Medium effort, high judging leverage, low technical risk.
- *Priority*: P1 (~2–3 hours).

### P2 — Polish & proof points (remaining time before final hours, ~6–8 hours)

**9. Wellness Gate Guardrail**
- *What*: A hard, non-LLM business rule sitting between the recommendation tool and the output layer: if `emi_miss_count >= 2` OR the stress module flags "at risk," **credit/loan/credit-card recommendations are automatically suppressed** and replaced with a supportive check-in message and (optionally) a lighter-touch product like a savings nudge or restructuring option.
- *Why included*: This is your strongest, most concrete answer to "avoiding predatory nudging" and "depth of personalization vs. genuine customer benefit" — it's a rule a judge can literally watch fire in the demo (show Sunita's persona before/after 2 missed EMIs).
- *Why not trust the LLM to "decide not to upsell"*: LLM judgment alone is not auditable or reliably enforceable — a compliance-minded judge will ask "what stops the model from recommending a loan to a stressed customer anyway?" You need a deterministic answer, not "we prompted it to be nice."
- *Impact*: Very high relative to effort — this is a small amount of code with an outsized story.
- *Priority*: P2, but treat as **effectively P0-priority for the pitch narrative** — implement as soon as Features 3 and 7 exist (~1–2 hours).

**10. Persona-Based Demo Storylines**
- *What*: Pre-scripted, seeded data states for Meera, Ramesh, and Sunita so the live demo is a reliable 3–4 minute walkthrough rather than an improvised click-through.
- *Why included*: Live demo reliability is itself a judging factor in practice — a rehearsed, narrative-driven demo reads as more "real" than a generic form-fill.
- *Why not a fully open/free-form demo only*: Free-form demos risk dead air or edge cases in front of judges; scripted personas guarantee you hit all three challenge points in order.
- *Impact*: High for presentation quality, near-zero technical risk.
- *Priority*: P2 (~1–2 hours, mostly data seeding + a demo script — see Section 10).

**11. Architecture & Compliance One-Pager**
- *What*: A single exported diagram (the one in Section 3) plus a short written note on DPDP/RBI alignment and bias mitigation, formatted for the "deliverables expected" list.
- *Why included*: Explicitly requested in the problem statement's deliverables list — skipping it costs you points regardless of prototype quality.
- *Impact*: Required deliverable; low effort since it's mostly assembled from this document.
- *Priority*: P2 (~1 hour).

### P3 — Stretch goals (only if time remains in the final hours)

**12a. Lightweight RAG for a Banking FAQ Assistant**
- *What*: A small FAISS/Chroma in-memory index over a handful of bank policy/FAQ documents, so the vernacular chat can also answer basic questions ("what documents do I need for KYC?").
- *Why included only as stretch*: Nice-to-have depth for the "conversational AI" ask, but not load-bearing for any single judging criterion on its own.
- *Priority*: P3 (~2 hours if time allows).

**12b. Recommendation Diversity / Bias Check**
- *What*: A simple post-hoc check that recommendations aren't systematically skewed against a synthetic income band or gender field in your dataset, surfaced as a small "fairness note" in the compliance panel.
- *Why included only as stretch*: Directly relevant to "algorithmic bias" in the ethical-safeguards ask, but only worth building once the core narrative is airtight — a half-built fairness dashboard is worse than a clear one-paragraph note.
- *Priority*: P3 (~1–2 hours).

**12c. Scalability Notes (design-only, not built)**
- *What*: A short written section (in the ADR) describing how the modular monolith would split into services (event-driven ingestion via Kafka, a feature store, a model registry) if this went to production.
- *Why included only as stretch/narrative*: Judges give credit for scalability *thinking*; building actual infrastructure in 36 hours would trade demo-visible polish for infra no one will see live.
- *Priority*: P3, written not built.

---

## 5. Data Model

```python
Customer = {
  "customer_id": str,
  "name": str,
  "segment": "salaried" | "gig" | "self_employed",
  "city_tier": 2 | 3 | 4,
  "preferred_language": "hi" | "en",
  "consent": {"transactions": bool, "location": bool, "spend_categories": bool},
}

Transaction = {
  "txn_id": str, "customer_id": str, "timestamp": datetime,
  "amount": float, "type": "credit" | "debit",
  "category": "salary" | "emi" | "upi_spend" | "bill" | "transfer" | "other",
}

Signals = {
  "customer_id": str,
  "salary_regularity_score": float,   # 0-1
  "savings_rate": float,              # 0-1
  "emi_miss_count_90d": int,
  "spend_volatility_30d": float,
  "income_type": str,
  "life_stage_tags": list[str],       # e.g. ["first_time_saver", "recent_emi_stress"]
}

Recommendation = {
  "customer_id": str,
  "product": str,
  "confidence": float,
  "reason_trace": list[str],          # e.g. ["savings_rate=0.32 > 0.2 threshold", "no active loan"]
  "plain_language_explanation": str,
  "wellness_gate_status": "passed" | "suppressed",
}
```

---

## 6. Agent / Tool Design

**Orchestrator system prompt — design principles** (write the actual prompt in code, this is the spec):
- State explicitly: "You are a decision *narrator*, not a decision *maker*, for anything financial. Always call a tool to get the underlying determination; your job is to explain it in plain, empathetic language."
- Require the model to always call `check_consent()` before calling `get_customer_signals()`.
- Require the model to never suggest a credit product without first calling `wellness_gate_check()`.

**Tools (implement as plain Python functions exposed via function-calling schema):**
- `get_customer_signals(customer_id) -> Signals`
- `recommend_product(signals) -> {product, confidence, reason_trace}` — deterministic scoring (e.g., simple weighted rules or a small decision table, not a trained model)
- `detect_stress_signals(customer_id) -> {is_at_risk: bool, reasons: list[str]}` — rule/statistical engine
- `check_consent(customer_id, data_scope) -> bool`
- `wellness_gate_check(customer_id, proposed_product) -> "passed" | "suppressed"`
- `vernacular_reply(user_message, language) -> str` — the one LLM-backed conversational tool

**Wellness Gate pseudocode:**
```python
def wellness_gate_check(customer_id, proposed_product):
    signals = get_customer_signals(customer_id)
    stress = detect_stress_signals(customer_id)
    if proposed_product in CREDIT_PRODUCTS and (
        signals.emi_miss_count_90d >= 2 or stress["is_at_risk"]
    ):
        return "suppressed"
    return "passed"
```

---

## 7. API Endpoints (FastAPI)

| Method | Path | Purpose |
|---|---|---|
| GET | `/customers/{id}` | Customer profile + consent state |
| GET | `/customers/{id}/signals` | Computed signals |
| GET | `/customers/{id}/recommendations` | Orchestrator-generated recommendations with reason traces |
| POST | `/chat/{customer_id}` | Vernacular conversational turn (body: `{message, language}`) |
| GET | `/customers/{id}/wellness` | Stress/anomaly status + intervention message if any |
| GET | `/customers/{id}/consent-log` | Audit log of AI decisions/data accessed |
| POST | `/consent/{customer_id}` | Update consent flags |

## 8. Frontend Screens (React)

1. **Dashboard** — customer picker (for demo, a dropdown of the 3 personas), income/spend chart, recommendation feed with expandable "Why?" cards, wellness status badge.
2. **Chat Widget** — floating/panel chat, language toggle (EN/HI), used for the onboarding-journey demo.
3. **Consent & Compliance Panel** — toggle switches per data category, audit log table.
4. **(Optional, P2) Persona Switcher / Demo Mode** — a hidden dev toggle to jump straight to each persona's pre-seeded state for a smooth live demo.

## 9. Explainability & Compliance Design

- **DPDP Act alignment**: explicit, granular consent per data category (not one blanket toggle); a visible purpose-limitation statement ("data used only for personalization, not shared with third parties" in the panel copy); a user-facing audit log of what the AI accessed.
- **RBI data-localization note**: state in the compliance one-pager that all data processing is designed to occur within India-hosted infrastructure in a production version (design note, not something to actually provision in 36 hours).
- **Avoiding predatory nudging**: the Wellness Gate (Feature 9) is the concrete mechanism; document it in both this file and the ADR as the primary anti-predatory control.
- **Algorithmic bias**: keep recommendation logic on interpretable signals/rules (Section 6) specifically because rule-based logic is auditable for bias in a way an opaque model isn't; mention the stretch fairness check (Feature 12b) as a further step.

## 10. Demo Script (aim for 3–4 minutes)

1. **(30s) Problem framing** — one sentence on generic banking apps failing Tier 2/3/4 India.
2. **(60s) Meera** — show salary credit → savings-rate signal → proactive recurring-deposit recommendation with expandable "why" card. Emphasize: *not* a pop-up, triggered at the right moment.
3. **(60s) Ramesh** — switch to chat widget, run a short KYC/loan-onboarding conversation in Hindi, show it handling code-mixed Hinglish gracefully.
4. **(60s) Sunita** — show the wellness dashboard flipping to "at risk" after her second missed EMI, show the empathetic check-in message, and show a *new* loan offer being visibly suppressed by the Wellness Gate rather than shown and ignored.
5. **(30s) Close** — one slide/panel: architecture diagram + consent/compliance panel, tying every feature back to a judging-criteria word ("explainable," "non-predatory," "vernacular-first," "scalable design").

## 11. 36-Hour Execution Plan (2–3 person team)

| Hours | Focus | Suggested split (3 people) | Suggested split (2 people) |
|---|---|---|---|
| 0–3 | Data generator + data model (Features 1) | Person A leads, others review schema | Both, pair on schema |
| 3–8 | Signal extraction + Recommendation tool + orchestrator skeleton (Features 2, 3) | Backend-strong person(s) on orchestrator; one starts dashboard shell | One on orchestrator, one on FastAPI/dashboard shell |
| 8–14 | Reasoning layer + Dashboard v1 (Features 4, 5) — **end-to-end P0 slice working by hour ~14** | Frontend person on dashboard; backend finishes reason traces | Alternate; get one persona fully working end-to-end first |
| 14–22 | Vernacular chat + Stress detection (Features 6, 7) | Split: one on chat, one on stress engine | Sequential: chat first (higher demo impact), then stress engine |
| 22–28 | Consent panel + Wellness Gate (Features 8, 9) | Whoever's free picks up consent panel while gate logic is added | Both — gate logic is small but must be correct |
| 28–32 | Persona seeding + demo rehearsal (Feature 10) | All hands — this is not optional | All hands |
| 32–34 | One-pager + polish (Feature 11) + bug bash | Split docs vs. bug fixing | Split docs vs. bug fixing |
| 34–36 | Buffer / stretch (Section 4, P3) / final rehearsal | — | — |

**Rule of thumb**: if you're behind schedule at hour 14, cut from P2/P3 first, never cut Feature 9 (Wellness Gate) — it's your cheapest, highest-leverage feature for the rubric.

## 12. Tech Stack & Libraries

- **Backend**: Python 3.11+, FastAPI, Pydantic for schemas, SQLite (or just JSON files) for the synthetic dataset — do not stand up Postgres for a 36-hour build (see `ADR-010`).
- **LLM/agent layer**: any tool-calling-capable LLM API your team has access to; keep the orchestrator prompt and tool schemas in version control as plain text/JSON so they're easy to iterate on live.
- **Frontend**: React (Vite), a charting library (Recharts) for the income/spend timeline, plain CSS or a lightweight utility framework — do not over-invest in design tooling with 36 hours on the clock.
- **Stretch RAG**: FAISS or Chroma, in-memory only.

## 13. Risk Mitigation / Fallback Plan

- **LLM API flakiness/rate limits during the live demo**: cache the exact API responses used in your rehearsed persona demo script and have a local fallback that replays them if the live call fails — never let a network hiccup kill your demo.
- **Time overrun on the vernacular chat (Feature 6)**: it's P1, not P0 — if it's not solid by hour ~20, fall back to a shorter scripted Hindi exchange rather than cutting it entirely, since it's your most visually distinctive feature.
- **Orchestrator behaving unpredictably**: keep every tool's output independently testable and demoable via a raw API call (Section 7) so you can show "the underlying logic is correct" even if the LLM's phrasing on stage is imperfect.

## 14. Self-Check Against the Judging Rubric

| Judging criterion | Primary feature(s) answering it |
|---|---|
| Innovation & technical feasibility | Agentic orchestrator + tool-calling (F3) |
| Depth of personalization vs. genuine benefit | Wellness Gate (F9) + reason traces (F4) |
| Explainability & RBI/regulatory compliance readiness | Reason traces (F4) + Consent Ledger (F8) |
| Usability for non-tech-savvy/vernacular-first users | Vernacular chat (F6) + Dashboard (F5) |
| Scalability & social/financial impact | Architecture design + ADR scalability notes (F11, `ADR-005`) |

Before your final rehearsal, walk this table out loud and make sure you can point to a specific screen or code path for each row — that's the actual win condition here, not any single "impressive" feature in isolation.
