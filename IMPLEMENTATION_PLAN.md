# 📐 DhanSathi — Implementation Plan (Phase 2, Features 12–25)

> **Purpose**: This is the single execution plan for all remaining features. It is the
> persistent memory for every implementation: each feature section tracks status,
> decisions made during build, and test evidence. Work proceeds **one feature at a
> time** — an agent must present the relevant section and get explicit approval
> before writing any code for that feature.
>
> **Process per feature (non-negotiable)**:
> 1. Restate the feature's plan section → get user approval.
> 2. Implement → run full Definition-of-Done checks → commit at the marked commit points.
> 3. Update the Status Tracking table + feature section's "Status" line → commit `docs: update implementation plan status`.
> 4. Only then move to the next feature.

---

## 0. Current State (as of Sep 12, 2026)

**Done & committed** (P0 Spine, P1 Differentiators, Feature 11):
- Deterministic engine: `getCustomerSignals` → `detectStressSignals` → `wellnessGate` → `recommendProduct` (ADR-011: LLM never decides financial answers)
- Orchestrator with real Gemini function-calling loop (`src/lib/agents/orchestrator.ts`)
- Vernacular chat + Hindi voice (`ChatWidget.tsx`, `/api/chat/[customerId]`)
- Consent manager + audit log (`ConsentManager.tsx`, `AuditLogPanel.tsx`, `src/lib/audit.ts`)
- **Feature 11 — LLM Guardrail Suite: ✅ DONE** (`src/lib/guardrails/*`: prompt injection shield, output validator, financial-accuracy guard; financial figure normalization fixed & verified live)
- Gemini hardening: model pin `gemini-3.5-flash`, lazy client init, `sendWithRetry` (429/500/503 backoff), chat grounding block built from `getRecommendationContext`
- Verify scripts: `verify-signals.ts`, `verify-stress.ts`, `verify-recommendation.ts`, `verify-chat-context.ts`

**Environment facts to respect (verified live)**:
- Free tier ≈ **5 req/min AND ~20 req/day per model** → batch verify scripts minimize LLM calls; deterministic tests never call Gemini. **Enable billing before demo day.**
- Chat models must set `systemInstruction` on `getGenerativeModel()`, never in `startChat()`.
- Model pin: `gemini-3.5-flash` (2.0/2.5 retired for new keys; 3.6+ rejects SDK 0.24.x legacy `role:"function"` turns).
- No stale `GEMINI_API_KEY` in shell env (overrides `.env`).

## 0.1 Definition of Done (applies to EVERY feature)

- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `npm run build` → success
- [ ] Affected `scripts/verify-*.ts` scripts all print `✅ PASS` (exit 0)
- [ ] Full `npm run eval` (once Feature 12 exists) → all assertions pass
- [ ] Dev-server smoke test of the touched API routes / pages (real HTTP)
- [ ] Docs touched: README (feature listed), ADR if a real decision was made
- [ ] Commits at every marked commit point — never one giant commit per feature

## 0.2 Implementation Order (and why)

| Phase | Order | Feature | Est. | Rationale for position |
|---|---|---|---|---|
| A (P1-Critical) | 1 | **F13 Contextual Timing Engine** | 1.5h | Pure deterministic tool, zero LLM risk; feeds F19 (NBA) and enriches F14 |
| A (P1-Critical) | 2 | **F15 Fraud/Anomaly Detection** | 1.5h | Pure deterministic tool; Challenge 3 explicitly requires "fraud" — currently unaddressed |
| A (P1-Critical) | 3 | **F26 RiskNet (ML)** | 2h | APPROVED — pure-TS LR from scratch; advisory-only, never decides; F15 + F26 together = "rules + ML" story |
| A (P1-Critical) | 4 | **F14 Guided Loan Journey** | 2h | Named deliverable; benefits from F13/F15/F26 being callable during the journey |
| A (P1-Critical) | 5 | **F12 Agentic Eval Suite** | 1.5h | Built last in Phase A so it asserts the *complete* pipeline incl. the ML tool — "run tests live" mic-drop |
| B (P2 quick wins) | 6 | **F19 Next-Best-Action** | 1h | Depends on F13 |
| B | 6 | **F18 PII Redaction Layer** | 45m | Defense-in-depth; feeds compliance narrative (F16) |
| B | 7 | **F17 Behavioral Segmentation** | 45m | Named deliverable; reuses signals + tags |
| B | 8 | **F16 RBI Compliance Page** | 30m | Static page; stronger after F18 exists to point at |
| B | 9 | **F20 Response Caching & Demo Hardening** | 1h | After all engines exist (cache them uniformly) |
| C (Ship & polish) | 10 | **F21 Vercel Deployment** | 1h | After hardening |
| C | 11 | **F22 Multi-Language Beyond Hindi** | 30m | Trivial; post-deploy polish |
| C | 12 | **F24 Architecture Visualization Page** | 45m | Static; includes final architecture incl. F13–F20 nodes |
| C | 13 | **F23 Observability & Tracing Dashboard** | 1h | Wraps all flows built above |
| C | 14 | **F25 Recommendation Fairness Audit** | 45m | Final report over the full customer base |

---

## 1. Feature 13 — Contextual Timing Engine (⏰ `computeTimingSignals`)

**Status: ✅ DONE** (commits `cdb34b2`, `d25ef65`) — 21/21 unit assertions + real-data verify + build green.

### Design (as implemented)
- **Pure core** `computeTimingCore(input)` in `src/lib/tools/computeTimingSignals.ts` — no LLM, no globals; takes `{ signals, transactions, now }` with an **injectable clock** so tests are 100% deterministic. Returns `TimingSignals & { reasonTrace }` (`TimingSignals`/`TimingUrgency` added to `src/lib/types.ts`).
- **5 priority rules** (first match wins — urgency & stress-prevention ordered):
  1. `emi_due_soon` (urgency `now`): next EMI within ≤3 days (predicted from historical EMI day-of-month pattern) AND low-balance proxy (`savingsRate < 0.10` OR `emiMissCount90d ≥ 1`). Reason explicitly says "a proactive alert, not an offer" so narration never sells during stress.
  2. `salary_credited_recently` (`now`): latest salary credit ≤48h old → savings-momentum nudge.
  3. `festival_savings_window` (`soon`): next festival in `FESTIVAL_CALENDAR` (deterministic UTC dates) ≤14 days out.
  4. `stable_savings_upgrade` (`scheduled`): savings rate ≥30% in each of the last 3 **full** calendar months.
  5. `spend_category_shift` (`soon`): TV-1/2 distance between last-two-month debit category distributions >0.4 → gentle check-in.
  6. Fallback: `trigger: null`, urgency `scheduled`.
- **Consent-gated wrapper** `computeTimingSignals(customerId, now?)` returns `ToolResult<TimingSignals>`; consent-denied → `trigger: null` + `timing=blocked` reason trace (no data access). Full reason trace = consent + signals + rule traces.
- **Orchestrator**: registered as `computeTimingSignals` function declaration; consent enforced in-loop; audited (`action: "computeTimingSignals"`, decision = trigger/urgency); system instruction tells the LLM to weave the timing reason in and to NOT push a product when the reason is a proactive alert. `recommend()` now returns `timing: ToolResult<TimingSignals> | null` (backward-compatible for existing consumers). Fallback pipeline appends `(Timing: …)` to narration and also returns timing.

### Decisions made during implementation
- UTC month arithmetic everywhere (full prior months only) — avoids DST/timezone nondeterminism.
- Rule 1 predicts the next due date from day-of-month history rather than storing a schedule — works with fixture data that has no explicit due-date field.
- EMI prediction window scans current + next month only (dedupes day-of-month >28 edge cases).
- No new dependencies; festival calendar is a hard-coded deterministic table (10 entries, 2026–2027).

### Test evidence
- `npx tsx src/tests/timingCore.test.ts` → **21 passed, 0 failed** (per-rule trigger + negative cases + priority ordering + calendar sanity).
- `npx tsx scripts/verify-timing.ts` (real data): Priya → `stable_savings_upgrade/scheduled`; Ramesh → `stable_savings_upgrade/scheduled`; Sunita → `emi_due_soon/now` (stressed → proactive alert, consistent with Wellness Gate narrative). Consent-denied path verified by unit tests (no such persona in fixture data).
- `npx tsc --noEmit` → 0 errors; `npm run build` → success (BUILD_EXIT=0).

### Commits
1. `cdb34b2` feat(F13): deterministic timing engine core with 5 priority rules
2. `d25ef65` feat(F13): register timing tool with orchestrator (consent-gated, audited) + verify script
3. (this commit) docs: update implementation plan status (F13)

## 2. Feature 15 — Fraud/Anomaly Detection (🔍 `detectAnomalies`)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (Challenge 3 explicitly names "fraud" and "unusual transaction patterns" — we currently detect *stress* but not fraud): deterministic rule + statistical engine that flags suspicious transaction patterns, integrated with empathetic intervention (never accusatory).

### Design
- New file: `src/lib/tools/detectAnomalies.ts`
  - Signature: `detectAnomalies(customerId: string): ToolResult<AnomalyReport>`
  - 5 deterministic rules (per SOLUTION_STRATEGY §20):
    1. `unusual_merchant` — first-ever merchant + amount > 2× customer's average txn
    2. `large_withdrawal` — single ATM debit > 50% of monthly income
    3. `frequency_spike` — daily txn count > 3× customer's normal daily count
    4. `category_shift` — spend distribution changed > 40% month-over-month
    5. `velocity_burst` — ≥ 2 high-value txns within 1 hour
  - Output contract:
    ```ts
    interface AnomalyReport {
      customerId: string;
      anomalies: { type: string; severity: "low" | "medium" | "high"; description: string; txnId: string }[];
      overallRiskScore: number; // 0-100, weighted sum of severities
      reasonTrace: string[];    // every rule evaluated + why each fired/didn't
    }
    ```
- Empathetic-intervention tie-in (Challenge 3: "intervene with empathy, not punishment"):
  - `riskScore ≥ 70` → output includes `recommendedIntervention: "HOLD + verify"` (suspend product pushes, suggest immediate support). Fraud is a *transaction* signal; stress is a *financial-health* signal — both independently suppress selling.
- Orchestrator: register tool + declaration ("was there anything unusual on my account?" → real answer).
- API route: `GET /api/customers/[id]/anomalies`.
- UI: minimal `AnomalyCard.tsx` on Dashboard (severity chips + risk gauge), no LLM.

### Test validation
- New: `scripts/verify-fraud.ts` — **≥ 10 assertions, zero LLM calls**: inline fixtures per rule (each rule fires exactly when expected, no cross-firing), plus a clean-history customer with `anomalies: []` and `riskScore: 0`.
- Extend `scripts/generate-data.ts`: add 5th demo persona `CUST_VIKRAM` (Tier-3, self-employed) whose seeded transactions trip exactly `large_withdrawal` + `velocity_burst` (deterministic demo moment). **Regenerating data can shift counts — re-run ALL existing verify scripts afterwards and fix any count assertions.**
- Live smoke: `/api/customers/CUST_VIKRAM/anomalies` returns ≥ 1 high-severity anomaly.

### Commits
1. `feat: fraud/anomaly detection engine (detectAnomalies, 5 rules)`
2. `feat: seed fraud demo persona + anomaly API route + dashboard card`
3. `test: verify-fraud script (10+ assertions)`
4. `docs: update implementation plan status (F15)`

### Risks
- Thresholds too aggressive → false positives on normal personas; verify script asserts Priya/Ramesh/Sunita produce ≤ expected anomalies.
- Data regeneration can shift other scripts' fixtures → rerun full verify suite immediately after.

---



## 3. Feature 14 — Guided Loan Journey Flow (🧭 `loanJourney` engine + chat UI)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (literally a named deliverable: "loan journey"; Challenge 2: "loan application, KYC"): multi-step guided loan application *through the chatbot*, with visual progress tracking, deterministic eligibility/KYC checks, and the Wellness Gate shaping the path (support-first for stressed customers).

### Design
- New file: `src/lib/tools/loanJourney.ts` — deterministic state machine, in-memory store (Map, session-scoped; documented as demo scope):
  ```ts
  type JourneyStepId = "product_selection" | "eligibility_check" | "kyc_verification"
    | "amount_term" | "review" | "submitted" | "support_path"; // support_path = gate-suppressed branch
  interface LoanJourneyState {
    customerId: string; currentStep: JourneyStepId; completedSteps: JourneyStepId[];
    productId: string | null; requestedAmount: number | null; tenureMonths: number | null;
    kyc: { method: "digilocker_sim" | null; status: "pending" | "passed" | "failed"; reasonTrace: string[] };
    wellnessGateApplied: boolean; reasonTrace: string[];
  }
  ```
- Exposed operations (all deterministic, all reason-traced):
  - `startLoanJourney(customerId, productId)` — blocked if consent denied (ADR-014); if wellness gate suppressed this product for this customer → journey auto-routes to `support_path` (EMI restructure/support-first), never a hard loan flow.
  - `checkEligibility(state)` — deterministic thresholds from existing signals (savings rate, EMI miss count, salary regularity) + anomaly risk from F15 (riskScore ≥ 70 → pause journey pending verification).
  - `simulateKyc(state)` — deterministic mock DigiLocker-style check (profile + consent complete → passed). Clearly labelled "simulated" in UI + narration (honesty rule).
  - `selectAmountTerm(state, amount, tenureMonths)` — validates against product min/max + affordability (EMI ≤ 40% of monthly surplus, deterministic).
  - `submitApplication(state)` — final reason trace + audit-log entry.
- Orchestrator: register 4 tools (`start_loan_journey`, `check_eligibility`, `submit_kyc`, `finalize_loan_application`) — the LLM *drives* the journey through tool calls and narrates each step; all decisions come from tools.
- API routes: `GET /api/customers/[id]/journey` (state for UI) + `POST` (advance step from UI buttons).
- UI: `JourneyTracker.tsx` — horizontal step progress bar rendered inside `ChatWidget` (auto-updates from chat-driven state); suppressed customers see "Support path" variant.

### Test validation
- New: `scripts/verify-loan-journey.ts` — **≥ 12 assertions, zero LLM calls**:
  - happy path: Priya full flow reaches `submitted`, all steps ordered
  - consent-denied start → blocked with reason trace
  - Sunita → wellness gate routes to `support_path` (no loan application possible)
  - KYC deterministic: complete profile → passed; missing consent → failed with reason
  - affordability: requested EMI > 40% surplus → rejected at `amount_term` with clear reason
  - F15 tie-in: riskScore ≥ 70 → eligibility paused
- Live smoke: orchestrator chat as Priya: "I want a personal loan" → journey tool calls visible, JourneyTracker advances (needs LLM quota → schedule after billing or off-peak).

### Commits
1. `feat: loan journey state engine (eligibility, KYC, affordability, support path)`
2. `feat: register journey tools with orchestrator + journey API routes`
3. `feat: JourneyTracker UI in ChatWidget (progress bar + support path variant)`
4. `test: verify-loan-journey script (12+ assertions)`
5. `docs: update implementation plan status (F14)`

### Risks
- In-memory journey state dies on dev-server reload → acceptable for demo; documented; API returns clean "start again" state.
- Orchestrator tool-count growth → keep declarations minimal; re-test one full persona conversation for loop stability.

---

## 4. Feature 12 — Agentic Eval Suite (🧪 `npm run eval`)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** ("technical feasibility" judging criterion — the live "let me run our test suite" moment): one command that asserts the ENTIRE agentic pipeline deterministically, printing a pass/fail table.

### Design
- New: `scripts/run-eval-suite.ts` + `npm run eval` (tsx runner, exit 1 on any failure).
- Collects all existing verify scripts' assertions into a single runner AND adds cross-cutting assertions no individual script covers:
  1. **Deterministic core**: signals → stress → gate → recommendation for all personas (expected-values table)
  2. **Consent enforcement**: every tool returns consent-blocked for a revoked customer
  3. **Timing rules** (F13): one assertion per rule
  4. **Fraud rules** (F15): one assertion per rule + clean customer
  5. **Guardrails**: injection patterns blocked, output schemas validated, financial guard catches a seeded hallucination AND passes a legit trace quote
  6. **Journey** (F14): happy path + suppressed path
  7. **LLM spot-check (1 call max, skipped if no quota)**: chat grounding — a "why" question returns a guardrail-passed reply; graceful SKIP printed on 429 so eval never fails on free-tier quota.
- Output: sectioned `✅/❌` table + timing per section + final `✅ ALL PASS` / `❌ N FAILURES`.

### Test validation (the feature IS the test)
- Runs green on the current tree; includes a self-check: `SEED_EVAL_FAILURE=1` proves the runner detects a seeded failure (suite isn't vacuous).
- The LLM spot-check must NEVER turn the suite red (skip + warn instead).

### Commits
1. `feat: agentic eval suite runner (npm run eval, 20+ assertions)`
2. `docs: eval suite section in README + implementation plan status (F12)`

### Risks
- Duplication with verify scripts → run-eval-suite imports/composes them rather than re-implementing.

---

## 5. Feature 19 — Proactive Next-Best-Action (🎯 `nextBestAction`)

**Status: ⬜ NOT STARTED — awaiting approval** (depends on F13, benefits from F15)

**Goal** (Challenge 1: "**proactively** recommend"): one deterministic banner at the top of the Dashboard: the single most relevant action right now, with WHY + WHEN (timing) — transforming the passive dashboard into a proactive assistant.

### Design
- New: `src/lib/nextBestAction.ts` — deterministic priority resolver over already-built engines:
  1. Fraud risk ≥ 70 (F15) → security check-in (never sell)
  2. Wellness gate suppressed (stress) → support action (EMI restructure CTA)
  3. Timing urgency `now` (F13) → trigger-specific action (e.g., "Salary just credited — start a SIP")
  4. Otherwise → the recommendation itself (CTA to chat: "Ask DhanSathi why")
- Output contract: `{ actionId, title, description, ctaLabel, reasonTrace, source: "fraud"|"wellness"|"timing"|"recommendation" }` — titles/descriptions are deterministic strings (per-language variants in a string map); LLM narration optional later via existing chat, NOT required.
- API: `GET /api/customers/[id]/next-best-action`; Dashboard banner component `NextBestActionBanner.tsx` (dismissible; audit-log the click).

### Test validation
- New: `scripts/verify-nba.ts` — ≥ 6 assertions: each of the 4 priority tiers wins over lower tiers in a forced fixture; Sunita → wellness tier; fraud-seeded VIKRAM → security tier; Priya → timing/recommendation tier.

### Commits
1. `feat: next-best-action resolver + API`
2. `feat: dashboard NBA banner UI`
3. `test: verify-nba script + implementation plan status (F19)`

---

## 6. Feature 18 — PII Redaction Layer (🛡️ `piiRedaction`)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (deliverable: "data privacy and consent"; defense-in-depth): even with consent granted, the LLM never sees raw Aadhaar/PAN/phone/email/account numbers — deterministic redaction on every LLM-bound payload and narration output.

### Design
- New: `src/lib/guardrails/piiRedaction.ts`:
  - `redactText(text): { redacted: string; findings: string[] }` — regex detectors for Aadhaar (12 digits w/ separators), PAN (ABCDE1234F), phone (+91/0-prefixed 10-digit), email, bank account (9–18 digits), IFSC.
  - Replacement: masked forms (`XXXXXXX1234`) so context survives, identity doesn't.
  - Wired: (a) chat route redacts `history` + user message before SI assembly; (b) orchestrator redacts tool payload strings passed into narration prompts; (c) output guard runs redaction on final replies.
- Demo data contains no real PII → add fake PII fields to 1–2 customer profiles to *demonstrate* redaction live (auditable in the trace).

### Test validation
- New: `scripts/verify-pii.ts` — ≥ 12 fixed cases: each detector hits/misses (incl. separators, spacing), false-positive guards (ordinary numbers like EMI amounts, 55.7% untouched), and an end-to-end: SI built with PII-bearing history → redacted before send (assert on the constructed prompt, no API call).

### Commits
1. `feat: PII redaction layer (Aadhaar/PAN/phone/email/account)`
2. `feat: wire redaction into chat route + orchestrator payload path`
3. `test: verify-pii (12+ cases) + implementation plan status (F18)`

### Risks
- Over-aggressive regex corrupting legitimate figures (₹ amounts, 55.7%) → explicit false-positive cases in verify script; EMI/score shapes are distinct from PAN/Aadhaar.

---


## 7. Feature 17 — Behavioral Segmentation Display (🧩 `behavioralSegment`)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (named deliverable: "behavioral segmentation"): assign each customer a human-readable behavioral segment derived deterministically from transaction patterns; show it as a badge with an explanation.

### Design
- New: `src/lib/tools/behavioralSegment.ts` — maps existing signals/lifeStageTags to named segments (e.g., `Disciplined Saver`, `Gig Saver`, `EMI Struggler`, `Impulse Spender`, `Cautious Builder`), each with a one-line explanation + reasonTrace. Rules ordered; deterministic; consent-gated like other tools.
- API: expose in `/api/customers/[id]` payload; UI: badge in `ProfileCard.tsx` with tooltip showing the reason trace.

### Test validation
- New: `scripts/verify-segmentation.ts` — ≥ 6 assertions: every persona gets the *expected* segment (assert data first, then expectation); boundary fixtures for two segments that differ by one signal.

### Commits
1. `feat: behavioral segmentation engine + profile badge`
2. `test: verify-segmentation + implementation plan status (F17)`

---

## 8. Feature 16 — RBI Compliance & Data Localization Page (📜 `/compliance`)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (deliverable: "RBI data localization norms" — most teams put this on a slide; we ship a page): in-app compliance page mapping every safeguard to regulation text.

### Design
- New: `src/app/compliance/page.tsx` (static, no LLM):
  - **DPDP Act 2023**: consent ledger (link to working UI), purpose limitation, withdrawal = immediate (already implemented)
  - **RBI data localization**: all data in-memory/in-repo for demo; production note on India-region storage; state *honestly* what leaves the device on LLM calls (derived, consented signals only)
  - **Algorithmic bias**: link to F25 fairness audit; deterministic rules are inspectable by design
  - **Anti-predatory design**: Wellness Gate suppression, no dark patterns, support-first flows
  - **Explainability**: every decision has a reason trace (show a real one inline)
- Footer/header link from main layout; link from consent panel.

### Test validation
- `npm run build` + page renders (smoke GET 200); content checked against deliverable wording (manual checklist recorded in this doc's status line).

### Commits
1. `feat: RBI/DPDP compliance page`
2. `docs: implementation plan status (F16)`

---

## 9. Feature 20 — Response Caching & Demo Hardening (⚡)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (demo reliability): sub-second dashboard loads, chat never hangs the demo, graceful degradation everywhere.

### Design
- New: `src/lib/cache.ts` — tiny in-memory TTL cache (Map + expiry) with `cached(key, ttlMs, fn)`; applied to `getRecommendationContext`, signals/stress/gate/recommendation routes, timing, anomalies, NBA (short TTLs — 60s — so consent changes still reflect).
- Pre-warm: `/api/prewarm` (POST, idempotent) computes all personas' contexts at server start / demo prep; README documents "click once before demo".
- Hardening pass: every LLM-dependent UI path shows a deterministic fallback message (already built in orchestrator) — audit each component for loading/error states; add timeouts to fetches.
- Latency log line per cached route (feeds F23 observability later).

### Test validation
- New: `scripts/verify-cache.ts` — ≥ 5 assertions: second call hits cache (spy on underlying tool call count), TTL expiry recomputes, consent change invalidates, prewarm endpoint warms all personas.

### Commits
1. `feat: TTL cache + prewarm endpoint`
2. `feat: apply cache to engines + demo hardening audit`
3. `test: verify-cache + implementation plan status (F20)`

---

## 10. Feature 21 — Vercel Deployment (🚀)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (team constraint: "Vercel free tier"): live URL >>> localhost; offline-proof demo via fallbacks.

### Design
- `vercel.json` if needed; `GEMINI_API_KEY` set via Vercel dashboard (NEVER committed).
- Serverless constraints audit: in-memory state (journey Map, consent overrides, cache) resets per lambda — **decision needed at implementation time**: document as demo scope or move state to a file-based store on Vercel (not possible on serverless) → pragmatic answer: consent/journey state live client-side via localStorage + server re-validation, OR accept per-instance reset and demo on one warm instance. Will present options before coding.
- Deploy → smoke ALL routes on prod URL (customers, wellness, consent toggle, chat deterministic-fallback path, compliance page).
- README: deploy steps + demo-day runbook (env, prewarm, offline fallback script).

### Test validation
- Prod smoke checklist (every API route 200 + one deterministic-fallback chat turn when key absent).

### Commits
1. `chore: vercel deployment config + env docs`
2. `feat: state persistence strategy for serverless (decision recorded in ADR)`
3. `docs: demo-day runbook + implementation plan status (F21)`

---


## 11. Feature 22 — Multi-Language Beyond Hindi (🌐)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (Challenge 2: "Hindi, Tamil, Telugu, etc."): full chat support in Tamil, Telugu, Kannada, Bengali via language selector; voice stays Hindi+English (Web Speech API constraint, honestly labelled).

### Design
- `ChatWidget.tsx`: language dropdown (persisted per customer); backend already parameterizes SI by `language`.
- Chat route: explicit script rule per language (e.g., Tamil: "Respond in Tamil script", Hinglish for hi) + transliteration preference toggle.
- Voice: disable mic for non hi/en with tooltip "Voice coming soon — text works in your language" (honesty rule).

### Test validation
- New: `scripts/verify-languages.ts` — deterministic: SI template renders correctly for each language code (assert prompt text, no API); 1 optional live LLM call per language OFF by default (`--live` flag) since free tier is scarce.
- Manual smoke: one Tamil + one Telugu chat turn if quota allows.

### Commits
1. `feat: multi-language chat (ta/te/kn/bn) + selector`
2. `test: verify-languages + implementation plan status (F22)`

---

## 12. Feature 24 — Architecture Visualization Page (🗺️ `/architecture`)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (deliverable: "conceptual architecture/flow diagram"): interactive diagram IN the app, not a slide.

### Design
- New: `src/app/architecture/page.tsx` with an embedded diagram (pure SVG/CSS — no new dependency, per dependency-minimalism).
- Nodes: Data sources → Consent gate → Deterministic engines (signals/stress/fraud/timing/segment) → Wellness Gate → Orchestrator (tool-calling loop) → Guardrails → Narration → UI. Arrows labelled with what each stage emits (reason traces!).
- "Why this architecture" side panel: 4 bullets from ADR-011/021 (LLM never decides; every number traceable; graceful degradation).

### Test validation
- Build + render smoke; content reviewed against final feature set (must include F13–F20 nodes).

### Commits
1. `feat: architecture visualization page`
2. `docs: implementation plan status (F24)`

---

## 13. Feature 23 — Observability & Tracing Dashboard (📡 `/admin/traces`)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (production-engineering maturity signal): see every LLM call, tool invocation, guardrail decision, latency, and token usage in one admin view.

### Design
- New: `src/lib/obs.ts` — ring buffer (last N=500 events) + typed event emitters wired into: `sendWithRetry` (model, latency, attempts, outcome), orchestrator tool loop (tool name, args hash, latency), guardrails (decision + reason), chat route (total latency, blocked-vs-passed).
- API: `GET /api/admin/traces` (dev-only: 404 unless `NODE_ENV=development` or `?key=ADMIN_KEY` env).
- UI: `src/app/admin/traces/page.tsx` — filterable table (customer, kind, outcome) + latency summary cards.

### Test validation
- New: `scripts/verify-observability.ts` — ≥ 6 assertions: scripted tool+guard+retry flow emits the expected event sequence into the buffer; buffer caps at N; no PII in event payloads (reuse F18 redaction on any message-derived field).

### Commits
1. `feat: observability event bus (sendWithRetry, tool loop, guardrails)`
2. `feat: /admin/traces dashboard + dev-only API`
3. `test: verify-observability + implementation plan status (F23)`

---


## 14. Feature 25 — Recommendation Fairness Audit (⚖️)

**Status: ⬜ NOT STARTED — awaiting approval**

**Goal** (deliverable: "algorithmic bias"): post-hoc fairness report over the full customer base — proof the recommendation engine doesn't discriminate by segment/city tier.

### Design
- New: `scripts/fairness-audit.ts` — runs `recommendProduct` + gate + segmentation across ALL customers in `src/data/customers.json` (not just personas), groups outcomes by `segment` and `cityTier`, reports: recommendation distribution, suppression rate, mean wellness score per group; flags any group-pair delta > threshold (e.g., suppression rate gap > 25pp) as `⚠️ REVIEW`.
- Output: console table + `docs/fairness-report.md` (committed — judges can read it).
- Add `npm run fairness`. With ~20 synthetic customers, the report states the sample-size caveat honestly.

### Test validation
- Script asserts it processed 100% of customers; asserts the known seeded outcome (suppression concentrated in the stressed persona *by design* — intentional differential treatment based on financial health, not demographics; that nuance goes in the report).

### Commits
1. `feat: fairness audit script + generated report`
2. `feat: compliance page link to fairness report + implementation plan status (F25)`

---

## 13a. Feature 26 — RiskNet: From-Scratch ML Risk Prediction (🧠 `predictRiskScore`)

**Status: ✅ APPROVED — implementation starting now** (ADR-022 amended → Accepted; pure-TS logistic regression from scratch, zero ML libraries, zero new runtime deps)

**Goal** (judging: "innovation & technical feasibility"): a genuine hand-built ML pipeline — data prep → train → evaluate → inference → per-prediction attribution — that predicts next-month EMI-miss risk. The model's weights are human-readable and shown in the UI ("the model's brain is inspectable").

### Design (approved)
- **Trainer** `scripts/train-ml-model.ts` (rewritten from the leaked-label draft):
  - **No leakage**: features from month *m* only; label = `1` iff customer missed an EMI in month *m+1*. Feature window and label window never overlap.
  - **Features (8, per customer-month)**: savings rate, salary regularity, EMI-to-income ratio, MoM debit trend, spend volatility (weekly CV), income volatility, category concentration (HHI), txn count (log). All deterministic, all computed from `transactions.json` alone.
  - **From-scratch LR**: batch gradient descent, L2 (`lambda=0.01`), fixed iterations (no sampling) → **bit-identical artifacts on re-run**. Standardization (z-score) inside the pipeline; artifact stores means/stds.
  - **Honest evaluation**: leave-one-customer-out CV (accuracy, precision, recall, ROC-AUC where computable) printed to console **and stored in the artifact** (`trainingMeta`).
  - **Artifact** `src/data/risk-model.json`: `{ version, featureNames, means, stds, weights, bias, trainingMeta }` — committed; inference never trains.
- **Inference tool** `src/lib/tools/predictRiskScore.ts`:
  - Loads artifact (module-level cache, no `fs` at request time beyond first load).
  - Returns `ToolResult<{ probability, riskBand: "low"|"medium"|"high", topFactors: [{feature, contribution, description}] }>` with reason traces incl. **attribution lines** ("62% of this risk score comes from your savings-rate drop").
  - Attributions = `weight_i × standardized x_i` (sum exactly to the logit — testable invariant).
  - **Advisory-only**: never flips `isAtRisk`, never overrides wellness score, never changes interventions (supersedes the earlier `isAtRisk = isAtRisk || true` draft — that line was a bug and is removed).
- **Orchestrator**: registered as a `predictRiskScore` function declaration, consent-gated (transactions consent) + audited like every tool.
- **UI**: "ML Risk Gauge" card on the dashboard — probability dial, risk band, top attribution factors. Clearly labeled *experimental*.
- **Type additions** (`src/lib/types.ts`): `RiskPrediction`, `RiskBand`, `RiskFactor`, `RiskModelArtifact`.

### Test validation (all deterministic, no network)
`src/tests/riskModel.test.ts`:
1. LR core converges on a synthetic separable dataset (train acc > 0.95).
2. Same seed + data → bit-identical weights (JSON.stringify equality).
3. Attributions sum to the logit within 1e-9 (per prediction, 10 random fixtures).
4. Artifact schema: version, 8 featureNames, weights/means/stds lengths match, trainingMeta present.
5. **Leakage guard**: for every training row, assert feature window (month m) ∩ label window (month m+1) = ∅.
6. `predictRiskScore` on fixture signals → probability in [0,1], band thresholds correct, topFactors sorted by |contribution| desc.
7. Consent-denied customer → blocked with reason trace, no model call.
8. Verify script `scripts/verify-risk.ts`: runs the 3 personas end-to-end, asserts reason traces contain attribution lines and ML probability is mentioned (not deciding) in stress output.

### Commits
1. `feat(ml): pure-TS logistic regression core (from scratch) + deterministic tests`
2. `feat(ml): leakage-free training pipeline + committed risk-model artifact with LOCO CV metrics`
3. `feat(ml): predictRiskScore tool (consent-gated, advisory-only) + orchestrator registration + risk gauge UI`
4. `docs: ADR-022 accepted (ML risk model) + strategy doc RiskNet + implementation plan status (F26)`

---

## 15. Status Tracking

| # | Feature | Status | Evidence |
|---|---------|--------|----------|
| 11 | LLM Guardrail Suite | ✅ DONE (06b92cd; norm fix a6ce407) | live chat: block + verified pass |
| 13 | Timing Engine | ✅ DONE (cdb34b2, d25ef65) | 21/21 unit + verify-timing (3 personas) + build green |
| 15 | Fraud Detection | ⬜ pending approval | — |
| 14 | Loan Journey | ⬜ pending approval | — |
| 12 | Eval Suite | ⬜ pending approval | — |
| 19 | Next-Best-Action | ⬜ pending approval | — |
| 18 | PII Redaction | ⬜ pending approval | — |
| 17 | Behavioral Segmentation | ⬜ pending approval | — |
| 16 | Compliance Page | ⬜ pending approval | — |
| 20 | Caching & Hardening | ⬜ pending approval | — |
| 21 | Vercel Deployment | ⬜ pending approval | — |
| 22 | Multi-Language | ⬜ pending approval | — |
| 24 | Architecture Page | ⬜ pending approval | — |
| 23 | Observability | ⬜ pending approval | — |
| 25 | Fairness Audit | ⬜ pending approval | — |
| 26 | RiskNet ML Risk Model | 🟨 IN PROGRESS (approved) | ADR-022 accepted; LR core + tests first |

## 16. Standing Decisions (record once, apply everywhere)

- **ADR-011 discipline**: every new "smart" behavior = deterministic tool first, LLM narration second. No exceptions.
- **Reason traces everywhere**: every tool emits them; UI shows them; verify scripts assert them.
- **Deterministic tests by default**: LLM-dependent tests are optional/`--live`-gated due to free-tier quotas.
- **Commit cadence**: sub-commits as listed per feature section, then a `docs: update implementation plan status (FXX)` commit.
- **No new runtime dependencies** without an ADR note.
- **Estimated total**: ~17h of feature work + integration testing + 3× demo rehearsal.

## 17. How This Document Works as Memory

- This file is committed to the repo — it survives sessions, terminal restarts, and context resets. Any agent resuming work reads §0 (state), §15 (tracking), then the approved feature's section.
- During each feature build: record decisions in the feature section under **"Decisions made during implementation"** (added as we go), and paste the final verify-script output into **"Test evidence"**.
- After each feature: update §15's row + the feature's Status line, commit the doc.

