# ArthaSaathi — Architecture Decision Records
### Companion to `ArthaSaathi_Solution_Design.md` — read that file first for full product/feature context.

> **Document purpose**: Each ADR below records a decision made for this hackathon build (theme: AI-Powered Hyper-Personalized Banking for Bharat), the alternatives considered, and the consequences accepted. Written so a coding agent or new teammate can understand *why* the code looks the way it does, not just what it does. Constraints assumed throughout: ~36-hour hackathon, 2–3 engineers, Python (FastAPI) + React stack.

Status legend: **Accepted** (build this way) · **Proposed** (default, revisit only if time allows) · **Rejected-alternative** (documented for context, not built).

---

## ADR-001: Agentic orchestration with deterministic tools, not an end-to-end LLM black box

**Status**: Accepted

**Context**: The core challenge asks for personalized recommendations, conversational simplification, and stress detection. The team's strength is agentic AI/GenAI. Judging explicitly rewards explainability and compliance readiness.

**Decision**: Use an LLM orchestrator that calls deterministic Python tools (`recommend_product`, `detect_stress_signals`, `check_consent`, `wellness_gate_check`) for anything that produces a financial determination. The LLM is only used to (a) decide which tool(s) to call and in what order, and (b) phrase the output in plain, empathetic language. Only the vernacular conversation tool is itself LLM-backed end-to-end.

**Alternatives considered**:
- *Single large LLM prompt doing everything, no tools*: rejected — reads as a "wrapper," fails explainability, cannot be audited or defended under judge questioning.
- *Fully deterministic pipeline, no LLM at all*: rejected — underuses the team's strongest skill area and weakens the "innovation" score; also produces stiff, non-empathetic language for the stress-intervention messages, which is explicitly asked for.

**Consequences**:
- (+) Every determination is independently testable via a raw API call, which is also your demo-risk mitigation (Section 13 of the solution doc).
- (+) Directly answers "explainability" with an architecture-level argument, not just a UI feature.
- (–) Slightly more upfront design work than either extreme; mitigated by keeping tool schemas simple (Section 6 of the solution doc).

**Judging impact**: Primary driver of "innovation & technical feasibility" and "explainability."

---

## ADR-002: Synthetic banking dataset, generated in-repo, instead of a real or public dataset

**Status**: Accepted

**Context**: No real bank data is available or compliant to use; public financial datasets (e.g., generic credit-card fraud datasets) don't reflect Indian UPI/salary/EMI behavior patterns.

**Decision**: Write a generator script producing ~15–20 synthetic customers with realistic Indian transaction patterns (monthly salary spikes, UPI micro-spend, EMI debit dates, festival-season bumps), including the three named demo personas.

**Alternatives considered**:
- *Public Kaggle fraud/transaction datasets*: rejected — wrong locale (mostly US/EU card-transaction shape), would force the demo narrative away from "Bharat"-specific signals (UPI, vernacular, Tier 2/3/4).
- *Scraping/simulating from a real bank's public statements*: rejected — no compliant source exists in the hackathon timeframe, and it risks misrepresenting real institutions.

**Consequences**:
- (+) Full control over demo narrative — you can guarantee Sunita's persona hits "2 missed EMIs" exactly when you need it to for the wellness-gate demo.
- (+) Clearly-labeled synthetic data is honest and expected in a hackathon context; state this openly rather than implying it's real.
- (–) Judges may (fairly) ask how signal thresholds would be calibrated on real data — have a one-sentence answer ready: "thresholds here are illustrative; in production they'd be calibrated against the bank's historical default/complaint data."

**Judging impact**: Enables reliable demoability across all three challenge points; indirectly supports "scalability" narrative by keeping the data layer swappable (see ADR-010).

---

## ADR-003: Rule-based + statistical stress/anomaly detection, not a trained ML model

**Status**: Accepted

**Context**: Challenge point 3 asks for detection of financial stress/fraud signals. No labeled fraud/default data exists for this synthetic dataset, and training time is unavailable in 36 hours.

**Decision**: Implement `detect_stress_signals` as a transparent rule + rolling-window statistical engine (missed-EMI counter, spend/inflow z-score over a trailing window, sudden spend-category shift), with the LLM used only to phrase the resulting message empathetically — never to make the stress determination.

**Alternatives considered**:
- *Isolation forest / autoencoder-style anomaly detection*: rejected — without real labels, "training" a model on synthetic data you generated yourself is circular and cannot be honestly validated; also less explainable to a compliance-minded judge than a named threshold rule.
- *LLM directly deciding "is this customer stressed?" from raw transactions*: rejected — non-deterministic, not auditable, and risky if the model's judgment is wrong in a live demo with no way to explain why.

**Consequences**:
- (+) Every stress flag has a named, inspectable reason ("2 EMIs missed in 90 days"), which is exactly what Feature 4 (reason traces) needs to work.
- (+) Defensible when a judge asks "how do you know this isn't just noise" — you can point to the specific rule.
- (–) Less "impressive-sounding" than claiming a trained fraud-detection model; mitigate by being upfront in the demo that this is an intentional, explainability-first design choice, not a shortcut — most judges will respect this more than an unverifiable ML claim.

**Judging impact**: Directly supports "explainability/compliance readiness" and "avoiding purely punitive/predatory" framing.

---

## ADR-004: Vernacular support via general-purpose multilingual LLM, not a custom-trained NLU/translation pipeline

**Status**: Accepted

**Context**: Challenge point 2 requires conversational AI in vernacular languages for first-time digital users. The team has GenAI/transformer strength but not time or data to fine-tune a language model in 36 hours.

**Decision**: Use the chosen LLM's native multilingual capability directly for the conversational onboarding tool (Hindi + English, tolerant of Hinglish/code-mixing), with a light prompt-level instruction to keep banking terminology simple.

**Alternatives considered**:
- *Fine-tuning a smaller open model on Hindi banking dialogue*: rejected — no labeled dialogue data exists, and fine-tuning infrastructure/time cost is disproportionate to the demo value versus just prompting a capable multilingual model.
- *Building a rules-based translation layer with fixed phrase banks*: rejected — brittle, breaks immediately on any user input outside the anticipated phrases, and undersells the team's GenAI strength.

**Consequences**:
- (+) Fast to build, plays directly to team strength, and modern general-purpose LLMs already handle Hindi/Hinglish reasonably well.
- (+) Easy to extend to more languages later by adjusting a prompt parameter, supporting the "scalability" narrative.
- (–) Quality depends on the base model's Hindi capability, which you don't control — mitigate by rehearsing the exact demo conversation and having a scripted fallback (see Solution Doc, Section 13).

**Judging impact**: Primary driver of "usability for non-tech-savvy and vernacular-first users."

---

## ADR-005: Modular monolith (single FastAPI service) for the hackathon build, not microservices

**Status**: Accepted

**Context**: "Scalability across a bank's existing digital infrastructure" is a judging criterion, but the team has 2–3 people and 36 hours.

**Decision**: Build one FastAPI service with clearly separated modules (signals, recommendation, stress-detection, consent, chat) that mirror the eventual service boundaries, but deploy and run it as a single process for the hackathon.

**Alternatives considered**:
- *Real microservices (separate deployable services per tool, message queue between them)*: rejected for the build — the operational overhead (multiple deployments, service discovery, inter-service auth) would consume most of the 36 hours on infrastructure invisible to judges.
- *No internal modularity at all (one big script)*: rejected — would make the codebase harder to demo/explain and wouldn't support the scalability narrative credibly.

**Consequences**:
- (+) All engineering time goes into judge-visible features.
- (+) The module boundaries chosen now (Section 6 of the solution doc — each tool as an independent function) are exactly the seams you'd cut along to extract real microservices later — state this explicitly in the pitch as your scalability story.
- (–) Judges asking "does this scale?" need a narrative answer rather than a running demonstration; prepare the one-paragraph answer from Section 9/Section 12c of the solution doc in advance.

**Judging impact**: Supports "scalability" via credible design narrative without spending build time on infrastructure.

---

## ADR-006: Hard-coded "Wellness Gate" business rule, not LLM discretion, for suppressing predatory offers

**Status**: Accepted

**Context**: Challenge point 3 explicitly warns against "purely punitive actions"; the broader judging criterion "depth of personalization vs. genuine customer benefit (not just upsell)" implies judges will specifically probe for anti-predatory design.

**Decision**: Implement `wellness_gate_check` as deterministic code (Section 6 pseudocode in the solution doc) that runs *before* any credit/loan/credit-card recommendation is surfaced, and cannot be overridden by the LLM's own judgment.

**Alternatives considered**:
- *Prompting the LLM to "avoid recommending loans to stressed users"*: rejected — not enforceable or auditable; an LLM can be prompted around, and "we asked it nicely" is not a credible compliance answer.
- *No suppression mechanism, just softer LLM language*: rejected — fails to actually address "avoiding predatory nudging," which is one of the explicit ethical-safeguard asks.

**Consequences**:
- (+) You can literally demo the gate firing (Sunita persona) — a concrete, auditable behavior beats any amount of stated intent.
- (+) Gives you a strong, specific answer to the hardest likely judge question: "what actually stops your AI from upselling a struggling customer?"
- (–) Adds a small amount of extra logic and one more demo beat to rehearse — worth it given the leverage (see Solution Doc Feature 9).

**Judging impact**: Single highest-leverage decision for "genuine customer benefit" and "ethical safeguards."

---

## ADR-007: Consent Ledger as a first-class entity, not an afterthought slide

**Status**: Accepted

**Context**: The problem statement explicitly asks for a note on data privacy/consent (DPDP Act) and RBI data-localization norms as part of the ethical-safeguards deliverable.

**Decision**: Model consent as structured, per-category data on every customer (`consent: {transactions, location, spend_categories}`) and require the orchestrator to call `check_consent()` before reading signals, with a visible UI panel and audit log.

**Alternatives considered**:
- *A single blanket "I agree" flag*: rejected — doesn't reflect DPDP's principle of purpose-specific, granular consent, and reads as a token gesture rather than a real design choice.
- *Consent mentioned only in the written compliance note, no working UI*: rejected — most competing teams will do exactly this; a working panel is a cheap way to visibly outperform on this specific point.

**Consequences**:
- (+) Turns a "checkbox" deliverable into a demoable, code-backed feature.
- (–) Small additional data-modeling and UI cost, budgeted at ~2–3 hours (Feature 8 in the solution doc).

**Judging impact**: Directly and cheaply satisfies "explainability & RBI/regulatory compliance readiness."

---

## ADR-008: Explainability-by-design — every AI output carries a structured reason trace

**Status**: Accepted

**Context**: Both recommendations and stress alerts need to be defensible to a judge and, in a real product, to a regulator.

**Decision**: Every tool that produces a determination returns not just a result but a `reason_trace: list[str]` of the specific signals/thresholds that led to it, decided at the data-shape level from the start (not bolted on later).

**Alternatives considered**:
- *Return only a final decision + confidence score*: rejected — a bare number is not an explanation and would need to be retrofitted later at higher cost.
- *Free-text LLM explanation with no structured trace*: rejected — a prose explanation generated by the same model making the call isn't independently verifiable; structure lets you show the actual underlying logic separately from the LLM's phrasing of it.

**Consequences**:
- (+) The "Why am I seeing this?" UI card (Feature 4/5) becomes almost free to build once this data shape exists.
- (+) Reduces risk of the "black box" critique from a judge with a compliance/banking background.
- (–) Requires deciding this data contract early — retrofitting it after tools are built would be more expensive, hence this decision is called out explicitly rather than left implicit.

**Judging impact**: Foundational to the "explainability" criterion across every feature, not just one.

---

## ADR-009: React SPA + FastAPI REST, not GraphQL or server-rendered pages

**Status**: Accepted

**Context**: Team's full-stack strength and 36-hour timeframe favor the fastest path to a working, demoable UI.

**Decision**: Plain REST endpoints (Section 7 of the solution doc) consumed by a React SPA (Vite), no GraphQL layer, no SSR framework.

**Alternatives considered**:
- *GraphQL*: rejected — adds schema/tooling overhead with no judge-visible benefit at this data scale (a handful of endpoints, ~20 synthetic customers).
- *Server-rendered pages (e.g., Jinja templates)*: rejected — slower to make visually polished and interactive within the timeframe than a React SPA the team already has muscle memory with.

**Consequences**:
- (+) Fastest path from backend logic to an on-screen demo.
- (–) None material at this scale.

**Judging impact**: Indirect — maximizes time available for judge-visible features rather than plumbing.

---

## ADR-010: SQLite/JSON persistence for the hackathon, with a documented production migration path

**Status**: Accepted (hackathon) / **Proposed** (production note only, not built)

**Context**: A real deployment would need a proper database, connection pooling, and probably a feature store; none of that is worth building for a 36-hour demo.

**Decision**: Persist the synthetic dataset as SQLite or plain JSON files loaded at startup. Document, but do not build, the production path: Postgres for transactional data, a small feature store for signals, and an event-driven ingestion layer (e.g., Kafka-style stream from core banking → signal extraction) for real-time updates at bank scale.

**Alternatives considered**:
- *Standing up Postgres + migrations for the hackathon*: rejected — pure overhead at ~20-customer scale, would consume hours better spent on Features 3, 6, 7, 9.
- *In-memory Python dicts with no persistence at all*: rejected — mildly risky if a demo process restarts mid-judging; SQLite/JSON gives cheap durability for near-zero extra cost.

**Consequences**:
- (+) All build time stays on judge-visible logic.
- (+) The "production path" paragraph gives you a credible, specific answer to the "how would this scale to millions of customers" question without having built it.
- (–) None material for a 36-hour build.

**Judging impact**: Supports "scalability" narrative credibly and cheaply, mirroring the reasoning in ADR-005.

---

## Summary Table

| ADR | Decision | Primary judging criterion served |
|---|---|---|
| 001 | Agentic orchestrator + deterministic tools | Innovation & feasibility, explainability |
| 002 | Synthetic Bharat-specific dataset | Enables all demos; supports scalability narrative |
| 003 | Rule/statistical stress detection, not trained ML | Explainability, honest/defensible design |
| 004 | General-purpose multilingual LLM for vernacular chat | Usability for vernacular-first users |
| 005 | Modular monolith, not microservices | Scalability (narrative) |
| 006 | Hard-coded Wellness Gate | Genuine benefit / anti-predatory (highest leverage) |
| 007 | First-class Consent Ledger | Compliance readiness |
| 008 | Structured reason traces everywhere | Explainability (foundational) |
| 009 | REST + React SPA | Execution speed (indirect) |
| 010 | SQLite/JSON now, documented DB path later | Scalability (narrative), execution speed |
