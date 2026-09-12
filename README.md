# DhanSathi

**AI-powered hyper-personalised banking for Bharat** — built for HackOut, theme: *Digital Transformation in Lending*.

A banking assistant whose defining feature is that it will refuse to sell you something.

---

## The one-sentence version

Every financial decision here is made by deterministic TypeScript you can read, a trained model can raise concern but never clear it, a hard-coded wellness gate can cancel any sale, and the language model is only ever allowed to narrate the result.

---

## Why this is different

Most personalisation systems answer *what should we sell this customer?* That question, asked of a customer in financial difficulty, produces exactly the harm the problem statement warns about. DhanSathi asks a different one: **should we be selling to this customer at all right now?**

Four things follow from that, and they are the parts worth looking at:

### 1. The wellness gate can cancel a sale

A hard-coded gate sits between the recommendation and the customer. When the signals show financial stress, it suppresses the offer — credit, investment and insurance alike — and substitutes support. The language model has no authority over it and cannot be prompted around it. Open **Sunita** to watch an offer get visibly suppressed.

### 2. The model catches what the rules miss — and only in the safe direction

A monotonic-constrained logistic regression runs alongside the rules. The governing principle:

> **The model proposes. The rules dispose.**

It can escalate a customer into protection. It can never unlock a product the rules withheld. A wrong model costs us a sale; it cannot cost a customer their safeguard.

Open **Suresh**: zero missed EMIs, wellness score 85/100, rules say he is fine. The model disagrees at 15.6%, above the intervention threshold, so his vehicle loan is held back and support is offered instead. That case was found in the data, not written into the demo.

### 3. Every decision tells you what would change it

Not just *why this product* — the question a declined customer actually asks: *what would I have to do differently?* Because every decision function is pure, we search the real pipeline and return the exact minimum change:

> *"If your missed EMIs in 90 days fell to 1 (currently 2), you would see a Systematic Investment Plan instead."*

Ask **"why was I not offered a Home Loan?"** and get a true answer, or an honest "no single change gets you there".

### 4. You can move time and watch it react

Drag the **Time Machine** slider. Rolling windows, EMI due dates, festival proximity and the wellness gate all recompute. Every team claims contextual timing; this one can be tested by the person hearing the claim.

---

## Run it

```bash
npm install
npm run dev
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
| `/compliance` | Consent, explainability, auditability and data residency, with demo scope stated honestly |

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
npm run train           # retrain, rewrite weights and the model card's numbers
npm run audit:fairness  # re-run the fairness audit over the full population
```

### On the data

The demo personas are synthetic and scripted (ADR-007), so the demo is reproducible on stage. The models are trained on a 6,000-customer population with a fully documented data-generating process, seeded for byte-reproducibility.

Swapping in a real ledger means replacing `buildPopulation()` in `scripts/population.ts` with a loader that emits the same `TrainingRow` shape. Nothing downstream changes — the contracts are dataset-agnostic by construction. `data/supplementary/README.md` carries the field mapping for a real 1M-transaction Indian bank dataset, including an honest account of what that dataset *cannot* support (it is debit-only, so it cannot train the distress model).

---

## Verification

Nothing here needs an API key.

```bash
npm run eval            # 21 safety invariants — the gate, monotonicity, tamper detection, scope
npm run verify          # counterfactuals, ML contract, guardrails, signals, stress, timing
npx tsc --noEmit        # typecheck
npm run build           # production build
```

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

- Consent persists in a cookie and the audit chain in process memory; both need durable storage for production. Stated on `/compliance` rather than hidden.
- Six model features, no informal income or household context — significant for exactly the customers this targets.
- No authentication, KYC, drift monitoring or appeals workflow.
- The fairness audit flags income type at 0.65, below the four-fifths threshold. We publish it, and argue the case, on `/fairness`.
