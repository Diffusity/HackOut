# DhanSathi

**AI-powered hyper-personalised banking for Bharat** — built for HackOut, theme: *Digital Transformation in Lending*.

A banking assistant whose defining feature is that it will refuse to sell you something.

---

## The one-sentence version

Every financial decision here is made by deterministic TypeScript you can read, a trained model can raise concern but never clear it, a hard-coded wellness gate can cancel any sale, and the language model is only ever allowed to narrate the result.

- **Persona dashboard**: Priya (salaried saver), Ramesh (gig worker), Sunita (financially stressed)
- **Reason traces**: every recommendation ships with a named, inspectable reason trace shown in the UI and audit log
- **Wellness Gate** (ADR-012): hard-coded suppression of sales pushes for at-risk customers — for Sunita you can watch an offer get visibly *suppressed* and replaced with support (`EMI_RESTRUCTURE`)
- **Consent-first privacy** (ADR-014): transaction data is only processed with consent; consent-denied chats refuse to discuss transaction data
- **Vernacular voice chat** (ADR-002/006): Web Speech API with Hinglish/English toggle
- **Grounded chat reasoning** (ADR-021): ask *"Why this product?"* (use the chip in the chat) — the LLM explains using **only** the deterministic reason trace, verified by output guardrails, with a deterministic fallback narration if the LLM is unavailable
- **Prompt-injection shield + output guardrails** (ADR-016), all blocks audit-logged
- **Contextual Timing Engine** (Feature 13, ADR-011): deterministic "WHEN" layer — 5 priority life-context rules (EMI due soon, salary just credited, festival window, stable savings momentum, spend-pattern shift) decide *when* to act and whether it's an offer or a proactive alert; LLM only narrates the timing
- **RiskNet — from-scratch ML risk model** (Feature 26, ADR-022): logistic regression trained entirely in pure TypeScript (no ML libraries) on the synthetic data — data prep → train → leave-one-customer-out CV → inference → per-prediction attributions. Predicts next-month EMI-miss probability; the model's weights are readable and the top attribution factors are shown in the dashboard's ML Risk Gauge. **Advisory-only**: it never flips `isAtRisk`, never overrides the wellness score, and never changes recommendations

## Why this is different

Most personalisation systems answer *what should we sell this customer?* That question, asked of a customer in financial difficulty, produces exactly the harm the problem statement warns about. DhanSathi asks a different one: **should we be selling to this customer at all right now?**

Six things follow from that, and they are the parts worth looking at:

### 1. The wellness gate can cancel a sale

A hard-coded gate sits between the recommendation and the customer. When the signals show financial stress, it suppresses the offer — credit, investment and insurance alike — and substitutes support. The language model has no authority over it and cannot be prompted around it. Open **Sunita** to watch an offer get visibly suppressed.

### 2. The model catches what the rules miss — and only in the safe direction

A monotonic-constrained logistic regression runs alongside the rules. The governing principle:

> **The model proposes. The rules dispose.**

It can escalate a customer into protection. It can never unlock a product the rules withheld. A wrong model costs us a sale; it cannot cost a customer their safeguard.

Open **Suresh**: zero missed EMIs, wellness score 85/100, rules say he is fine. The model disagrees at 15.6%, above the intervention threshold, so his vehicle loan is held back and support is offered instead. That case was found in the data, not written into the demo.

### 3. Every decision tells you what would change it

Not just *why this product* — the question a declined customer actually asks: *what would I have to do differently?* Because every decision function is pure, we search the real pipeline and return the exact minimum change:

> *"If your missed EMIs in 90 days fell to 0 (currently 2), you would see a Systematic Investment Plan instead."*

Ask **"why was I not offered a Home Loan?"** and get a true answer, or an honest "no single change gets you there".

### 4. Withholding data costs protection, and we say so

Consent is per scope, and each scope removes real capability. Switch off spend categories for **Sunita** and her two missed EMIs become invisible — we cannot tell an EMI from a grocery bill — so the wellness gate never fires and she is offered an investment product instead of support.

> The same data that lets a bank sell to you is the data that lets it notice you are in trouble.

That is the honest shape of the privacy trade-off in lending. A customer is entitled to make it either way, but only if someone tells them what it costs. We tell them, on the card, in plain words.

### 5. It implements two RBI rules almost nobody implements

Request a loan and you get a real **Key Facts Statement** — the document RBI made mandatory for retail term loans from 1 October 2024. Unique proposal number, itemised charges split between lender and third party, Part 2 qualitative disclosures, an amortisation schedule, and an **APR computed by internal rate of return** over the amount you actually receive.

For the personal loan that is **14.5% nominal against an 18.03% APR**, because ₹5,500 of charges come out before the money reaches you — you receive ₹2,53,500 of the ₹2,59,000 sanctioned. The gap between those two numbers is the entire reason the disclosure is mandated.

Accept it and a **cooling-off period** starts. Exiting is one request — principal plus proportionate APR, zero penalty, upfront fees refunded. No call centre, no retention script.

And a customer the wellness gate has flagged cannot reach a Key Facts Statement at all. That refusal is enforced server-side, so it survives calling the API directly.

### 6. You can move time and watch it react

Drag the **Time Machine** slider. Rolling windows, EMI due dates, festival proximity and the wellness gate all recompute. Every team claims contextual timing; this one can be tested by the person hearing the claim.

---

## Run it

```bash
npm install
npm run dev
```

That is the whole setup. **No database and no API key are required** — the app runs on a bundled seed and the header tells you which source is live.

To run it on Postgres instead:

```bash
# Create a Supabase project in the Mumbai (ap-south-1) region.
# Copy the connection-pooler URI into .env as DATABASE_URL, then:
npm run db:seed     # creates the schema and loads the demo data
npm run db:check    # row counts and audit-chain integrity
npm run db:verify   # 26 integration assertions against the live database
```

Or locally, with no account:

```bash
docker run -d --name dhansathi-pg \
  -e POSTGRES_PASSWORD=dhansathi -e POSTGRES_DB=dhansathi \
  -p 55432:5432 postgres:16-alpine
# DATABASE_URL=postgres://postgres:dhansathi@localhost:55432/dhansathi
```

`.env` (optional — see below):

```
GEMINI_API_KEY=<your Google AI Studio key>
```

**The entire product works without an API key.** Recommendations, the wellness gate, the model, counterfactuals, the timing engine, the audit chain and the chat all run deterministically. A key only upgrades the narration from grounded templates to LLM prose, and the UI labels which one spoke. This is deliberate: the Gemini free tier allows roughly 20 requests a day, and a demo that dies on quota is not a demo.

---

## What is in here

| Page | What it shows |
|---|---|
| `/` | Customer dashboard: signals, recommendation, counterfactuals, model contributions, SMS/IVR rendering, audit chain |
| `/model-card` | What the model is, how it was measured, how the threshold was chosen, what it must never be used for |
| `/fairness` | Offer rates by gender, city tier and income type, with the four-fifths rule applied — including the result that fails |
| `/compliance` | Consent, explainability, auditability, RBI lending disclosures and data residency |
| `/loan/[proposal]` | The RBI Key Facts Statement for a loan offer, with the APR computation sheet and cooling-off exit |

### The four demo personas

| Persona | The point |
|---|---|
| **Priya** — salaried saver | Normal path: a recommendation with contextual timing |
| **Ramesh** — gig worker | Irregular income sized correctly, not penalised |
| **Sunita** — under stress | The wellness gate suppresses a sale in front of you |
| **Suresh** — early warning | The model flags a customer the rules cleared, before anything goes wrong |

---

## The machine learning

Trained offline, shipped as JSON, inferred in TypeScript. No Python in production, no ML runtime, no native binary, no cold-start download — the only shape of ML that belongs on a free serverless tier.

- **Distress model** — L2-regularised logistic regression with **monotonic sign constraints**, so no coefficient can take an indefensible sign no matter what the noise suggests. Test AUC 0.72, which is honest for a 7% base rate; a near-perfect score would mean label leakage.
- **Segments** — k-means over behavioural features, used for cohort comparison ("saves more than 75% of comparable customers").
- **Threshold selection** — by explicit cost, not accuracy. A false positive costs one suppressed offer; a false negative sells credit to someone sliding into distress. We price the miss at 10× and minimise total cost, subject to flagging at most 20% of customers so interventions stay actionable.
- **Exact attributions** — the model is additive, so the reasons shown to a customer are the real arithmetic, not a post-hoc approximation of a black box.

```bash
npx tsx scripts/verify-signals.ts        # signal extraction per persona
npx tsx scripts/verify-stress.ts         # stress scoring + wellness gate (Sunita → suppressed)
npx tsx scripts/verify-chat-context.ts   # chat grounding context per persona (ADR-021)
npx tsx scripts/verify-recommendation.ts # full orchestrator end-to-end (real LLM if key valid)
npx tsx src/tests/timingCore.test.ts     # deterministic timing-engine unit tests (21 assertions)
npx tsx src/tests/riskModel.test.ts      # deterministic RiskNet tests (59 assertions incl. leakage guard)
npx tsx scripts/verify-timing.ts         # timing triggers per persona (real data)
npx tsx scripts/verify-risk.ts           # ML risk predictions per persona (Sunita → high band)
npx tsx scripts/train-ml-model.ts        # retrain the risk model (bit-identical artifact)
npx tsc --noEmit                         # typecheck
```

### On the data

The demo personas are synthetic and scripted (ADR-007), so the demo is reproducible on stage. The models are trained on a 6,000-customer population with a fully documented data-generating process, seeded for byte-reproducibility.

Swapping in a real ledger means replacing `buildPopulation()` in `scripts/population.ts` with a loader that emits the same `TrainingRow` shape. Nothing downstream changes — the contracts are dataset-agnostic by construction. `data/supplementary/README.md` carries the field mapping for a real 1M-transaction Indian bank dataset, including an honest account of what that dataset *cannot* support (it is debit-only, so it cannot train the distress model).

---

## Data

`/compliance` reports the database region **read from the live connection**, not hard-coded. If the project is not in an Indian region it says so plainly rather than claiming localisation it does not have.

With `DATABASE_URL` set, customers, transactions, the consent ledger, the audit chain and loan offers live in Postgres. Without it, the app runs on the bundled JSON seed and says so in the header.

The architecture has **exactly one async boundary**: `initRequest()` loads a snapshot, and every decision function downstream is synchronous and pure over it. That is not a style preference — the counterfactual engine sweeps the decision function hundreds of times per request, so it can never touch a database mid-search. The database is never in the path of a decision: a slow database makes the page slower, it cannot make the answer wrong.

## Verification

Nothing here needs an API key or a database.

```bash
npm run eval            # 21 safety invariants — the gate, monotonicity, tamper detection, scope
npm run verify          # counterfactuals, ML, guardrails, KFS/APR, signals, stress, timing
npx tsc --noEmit        # typecheck
npm run build           # production build
```

`npm run db:verify` is the one that needs credentials. It asserts what a reviewer would reasonably doubt: that the audit chain **continues from the persisted head after a simulated instance restart** rather than quietly starting over, that tampering with a stored row is detected, that re-persisting the same records cannot fork the chain, and that a Key Facts Statement survives issue, accept and cooling-off cancel intact.

The eval suite asserts the things that must never regress: a stressed customer is never sold credit, risk never falls as missed EMIs rise, altering a past audit record breaks verification, off-topic questions get distinct refusals, and every persona's decision fits in a 160-character SMS in both languages.

---

## Architecture

```
consent check
  → deterministic signals
  → product recommendation (rules)
  → distress model (may escalate, never clear)
  → WELLNESS GATE (can cancel any sale)
  → narration (LLM, or grounded templates)
  → output guardrails
  → hash-chained audit record
```

The language model appears exactly once, at the end, with no authority.

`ADR.md` records all 30 architecture decisions with their rationale, alternatives and consequences — including **ADR-027**, which amends an earlier decision to reject ML and explains why the reasoning was right but the conclusion too broad.

---

## Known limits

- Without `DATABASE_URL` consent falls back to a cookie and the audit chain to process memory. With it, both are durable; production would add write-once storage and revoke UPDATE/DELETE at the role level.
- No authentication. Anyone with a proposal number can read that Key Facts Statement.
- Six model features, no informal income or household context — significant for exactly the customers this targets.
- No authentication, KYC, drift monitoring or appeals workflow.
- The fairness audit flags income type at 0.65, below the four-fifths threshold. We publish it, and argue the case, on `/fairness`.
