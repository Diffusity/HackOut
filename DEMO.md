# Demo script — 4 minutes

Written for whoever is presenting. Times are cumulative. The whole demo runs without an API key; nothing here depends on quota.

**Before you start:** `npm run dev`, dashboard open on Priya, browser at a readable zoom, theme matched to the room (dark if projected, light if on a screen). Have `/fairness` open in a second tab.

---

## 0:00 — The line that frames everything (20s)

> "Every team here built something that decides what to sell a customer. We built something that can decide **not** to sell. That distinction turns out to change the whole architecture."

Do not open with the tech stack. Open with this.

---

## 0:20 — Priya: the normal path (40s)

On the dashboard, point at three things and move on:

- **The recommendation** — SIP, with a plain-language explanation.
- **The reason trace** (expand it) — "every threshold that fired, shown to the customer, not kept in an internal log."
- **"What would change this"** — *"If your savings rate fell to 40%, you would see a Recurring Deposit instead."*

> "That last panel is a counterfactual. It is not the model guessing — every decision function in this app is pure, so we search the real pipeline and return the exact minimum change. Regulators require reasons for an adverse decision *and* a route to recourse. This is the route."

Click **"Why was I not offered a Home Loan?"** Let it answer.

---

## 1:00 — The Time Machine (35s)

Drag the slider forward ~45 days.

> "Every timing rule takes an injectable clock, so I can move time and the whole pipeline recomputes — rolling windows, EMI due dates, festival proximity, the gate."

Watch the recommendation change. Point out that after 45 days without a salary credit, her income regularity has degraded and the gate closes.

> "Everyone in this room will claim contextual timing. This is the version you can falsify while I'm standing here."

Reset to today.

---

## 1:35 — Sunita: the gate closes (45s)

Switch persona.

> "Sunita has missed two EMIs. The recommender still picks her natural product — we deliberately do not short-circuit it — and then the wellness gate suppresses it and substitutes EMI restructuring."

Point at the suppression notice, which names the product that was withheld.

> "This gate is hard-coded. The language model has no authority over it and cannot be prompted around it. That is the whole reason the LLM never touches a financial decision in this system."

Then the counterfactual panel:

> "And she can see exactly what would reopen the offer: one fewer missed EMI."

---

## 2:20 — Suresh: the model earns its place (50s)

Switch persona. **This is the strongest 50 seconds you have.**

> "Suresh has missed nothing. Zero EMIs. The rules score him 85 out of 100 — healthy."

Point at the model panel.

> "The model disagrees. It puts him at 15.6%, above our intervention threshold, because his income regularity and expense ratio match customers who ran into trouble within 90 days. So the offer is held back before anything has gone wrong."

Then the line that matters:

> "The rule is: **the model proposes, the rules dispose.** It can pull someone into protection. It can never release someone the rules flagged. A wrong model costs us a sale — it cannot cost a customer their safeguard."

Point at the contribution bars.

> "And because it's an additive model with monotonic constraints, these contributions are exact arithmetic, not a SHAP approximation of a black box. More missed EMIs can never lower risk, by construction — that's a fair-lending guarantee, enforced during training."

**If asked "did you plant this persona?"** — No. He is one of fifteen in the seed data; the escalation fell out of the model.

---

## 3:10 — Ask it something it shouldn't answer (20s)

Open the chat. Type: **"who won the cricket match"**

> "Refused before any model call — named the topic, offered three things it can help with. Ask it about the weather and you get a different refusal, not the same one recycled."

Then click the **"Why EMI restructuring?"** chip and let it answer properly.

---

## 3:30 — The proof layer (25s)

Scroll to the audit ledger.

> "Every decision is a sealed record carrying the SHA-256 of the one before it. Change any past entry and every hash after it breaks. Our test suite tampers with a record and asserts that verification fails."

Expand one record to show the prev/self hashes.

Then the SMS panel:

> "And the same decision, rendered as a 160-character Hindi SMS and an IVR script. Tier-3 and Tier-4 customers bank on feature phones over 2G. The decision layer doesn't care what channel it lands on."

---

## 3:55 — Close on the fairness tab (25s)

Switch tabs to `/fairness`.

> "The brief names algorithmic bias. Most answers to that are a bullet point. We ran the entire pipeline over six thousand customers and applied the four-fifths rule. Gender passes at 0.98. City tier passes at 0.92."

Pause.

> "Income type fails at 0.65. The gate holds back offers from gig workers far more often than from salaried customers. We think that's justified — the disparity is in offers withheld, not support denied, and it falls on exactly the people worst served by badly timed credit. But we're not confident enough in that to hide the number. A product that suppressed this would be less trustworthy than one that publishes it and argues the case."

> "That's the whole submission: the model card, the fairness audit, and thirty architecture decisions are all in the repo, including the one where we reversed ourselves on using ML at all."

---

## Questions you should expect

**"Where is the AI? This looks like if-statements."**
That's the design. A trained model runs on every customer — monotonic logistic regression, model card at `/model-card` with AUC, calibration and per-cohort performance. It ranks and escalates. It does not gate. In lending, putting a statistical artefact in charge of whether a vulnerable customer gets sold credit is the failure mode, not the goal.

**"Only 0.72 AUC?"**
At a 7% base rate, honest. A model claiming 0.95 on this task is leaking its label. Our threshold isn't chosen for accuracy anyway — it's chosen by cost ratio, because a missed warning is roughly ten times worse than a false alarm.

**"Is the data real?"**
Demo personas are synthetic and scripted so this demo is reproducible on stage. The models train on a 6,000-customer population with a documented, seeded generating process. Swapping in a real ledger is one function — `buildPopulation()` — because the tool contracts are dataset-agnostic. The mapping for a real 1M-transaction Indian dataset is in `data/supplementary/README.md`, including what that dataset can't support.

**"What happens if the LLM is down?"**
Nothing important. Try it — the whole product runs without an API key. The UI tells you which narrator spoke.

**"What's missing?"**
Auth, KYC, durable storage for the audit chain, drift monitoring, an appeals workflow. All listed on `/compliance`. A team that can't name what's missing hasn't understood what shipping this would take.
