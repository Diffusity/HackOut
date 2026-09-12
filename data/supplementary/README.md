# Supplementary (Real-World) Dataset Reference

## Purpose

The **primary** demo dataset for DhanSathi is the hand-crafted synthetic dataset in
`src/data/` (see ADR-007). It is deterministic, narratively scripted for the three
demo personas, and needs no external download — this is what the live demo runs on.

This folder documents a **supplementary reference** to a real-world dataset, cited to
demonstrate that the pipeline's deterministic tool contracts (signals → stress →
wellness gate → recommendation) generalize beyond ~20 synthetic customers.

## Cited dataset

| Field | Value |
|---|---|
| Title | Bank Customer Segmentation (1M+ Transactions) |
| Author | shivamb |
| URL | https://www.kaggle.com/datasets/shivamb/bank-customer-segmentation |
| Contents | ~1,000,000 real transactions from an Indian bank (transaction-level log) |
| License | Verify on the Kaggle page ("License" section) before any redistribution — do **not** commit the CSV to this repo |

## Download (optional, not required for the demo)

1. Create/sign in to a Kaggle account.
2. Visit the URL above → **Download** → `bank_customer segmentation CSV` (~500 MB uncompressed).
3. Place the CSV in this folder (it is gitignored via `data/supplementary/.gitignore`) — never commit it.

## Field-mapping plan (Kaggle columns → our `Signals` contract)

The `Signals` tool contract (`src/lib/types.ts`, produced by `getCustomerSignals`)
is derived from a transaction log, which is exactly what the Kaggle dataset provides.
Mapping (to be implemented in a batch script if we pursue this):

| Kaggle column | Meaning | Maps to |
|---|---|---|
| `CustomerID` | Unique customer | `customerId` |
| `TransactionDate` / `TransactionTime` | When the txn occurred | Timestamps for all time-window computations |
| `TransactionAmount (INR)` | Amount in ₹ | Debit/credit amount (bank debits → debits; the dataset is debit-side only, so savings rate needs a salary-proxy caveat) |
| `CustAccountBalance` | Balance after/before txn | Savings-rate sanity check |
| `CustGender`, `CustomerDOB` | Demographics | Profile enrichment (not used by current signals) |
| `CustLocation` | City | City-tier inference (Tier 1/2/3) |
| *(none)* | Salary credits | Not present — salary regularity requires a credit-side log or proxying recurring inflows |

### Known caveats (documented, honest)

- The Kaggle log is **debit-dominant** (no salary credits), so `savingsRate` and
  `salaryRegularityScore` cannot be computed faithfully from it as-is. A production
  adapter would need the bank's full credit+debit ledger. This is *why* the synthetic
  dataset (which models both sides) remains the primary demo data.
- Stress scoring (ADR-015) maps cleanly: EMI category detection and weekly spend
  volatility are computable from debit transactions alone.

## Effort estimate if implemented

~2–3 hours: a `scripts/ingest-kaggle.ts` batch script that aggregates the CSV into
the same per-customer monthly rollups our tools consume, plus a streaming read of the
1M rows. Out of scope for the 36-hour build; kept as a judge-question answer:
"our contracts are dataset-agnostic — here is the mapping plan."
