/**
 * RiskNet feature pipeline (Feature 26, ADR-022).
 *
 * Pure functions over Transaction[] — no I/O, no clock, no globals.
 * Shared by the trainer (scripts/train-ml-model.ts), the tests, and the
 * leakage guard so training and inference use byte-identical logic.
 *
 * STRICT LABELING CONTRACT (leakage guard enforces this):
 *   - Features for row (customer, month m) are computed from transactions
 *     with timestamps in month m ONLY.
 *   - Label = 1 iff the customer missed an EMI in month m+1.
 *   - Feature window (month m) and label window (month m+1) NEVER overlap.
 */
import { Transaction } from "../types";

export const FEATURE_NAMES = [
  "savingsRate",
  "salaryRegularity",
  "emiToIncomeRatio",
  "momDebitTrend",
  "spendVolatility",
  "incomeVolatility",
  "categoryConcentration",
  "logTxnCount",
] as const;

export const FEATURE_DESCRIPTIONS: Record<string, string> = {
  savingsRate: "share of income saved this month",
  salaryRegularity: "salary arrived as expected this month",
  emiToIncomeRatio: "EMI burden as a share of income",
  momDebitTrend: "spend change vs the previous month",
  spendVolatility: "week-to-week spending swings",
  incomeVolatility: "income stream stability",
  categoryConcentration: "how concentrated spending is in one category",
  logTxnCount: "transaction activity level",
};

export interface RiskRow {
  customerId: string;
  /** Month key of the FEATURE window, e.g. "2026-04" */
  monthKey: string;
  /** Next month key — where the label comes from, e.g. "2026-05" */
  labelMonthKey: string;
  features: number[];
  label: 0 | 1;
}

export function monthKey(ts: Date | string): string {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function nextMonthKey(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return monthKey(new Date(Date.UTC(y, m, 1))); // m is 1-based; Date month is 0-based → next
}

export function groupByMonth(txns: Transaction[]): Map<string, Transaction[]> {
  const map = new Map<string, Transaction[]>();
  for (const t of txns) {
    const k = monthKey(t.timestamp);
    const arr = map.get(k);
    if (arr) arr.push(t);
    else map.set(k, [t]);
  }
  return map;
}

/** Mean of a numeric array; 0 for empty input. */
function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Coefficient of variation; 0 when the mean is 0. */
function cv(values: number[]): number {
  const m = mean(values);
  if (m <= 0) return 0;
  const variance = values.reduce((a, v) => a + (v - m) ** 2, 0) / values.length;
  return Math.sqrt(variance) / m;
}

/**
 * The 8 deterministic features for one customer-month.
 * All computed from month-m transactions only. `prevMonthDebitTotal`
 * (from month m-1) is used ONLY for the MoM trend feature and never mixes
 * m-1 data into any other feature.
 */
export function extractFeatures(
  monthTxns: Transaction[],
  prevMonthDebitTotal: number | null
): number[] {
  const credits = monthTxns.filter((t) => t.type === "credit");
  const debits = monthTxns.filter((t) => t.type === "debit");
  const totalCredit = credits.reduce((a, t) => a + t.amount, 0);
  const totalDebit = debits.reduce((a, t) => a + t.amount, 0);

  // 1. savingsRate
  const savingsRate = totalCredit > 0 ? Math.max(0, (totalCredit - totalDebit) / totalCredit) : 0;

  // 2. salaryRegularity: salary credits present, softened by count (gig customers may have 2)
  const salaryCount = credits.filter((t) => t.category === "salary").length;
  const salaryRegularity = Math.min(1, salaryCount);

  // 3. emiToIncomeRatio
  const emiTotal = debits.filter((t) => t.category === "emi").reduce((a, t) => a + t.amount, 0);
  const emiToIncomeRatio = totalCredit > 0 ? emiTotal / totalCredit : 0;

  // 4. momDebitTrend: (thisMonth - prevMonth) / prevMonth, when prior month exists
  const momDebitTrend =
    prevMonthDebitTotal !== null && prevMonthDebitTotal > 0
      ? (totalDebit - prevMonthDebitTotal) / prevMonthDebitTotal
      : 0;

  // 5. spendVolatility: CV across six 5-day buckets of the month
  const buckets = [0, 0, 0, 0, 0, 0];
  for (const t of debits) {
    const day = new Date(t.timestamp).getUTCDate();
    buckets[Math.min(5, Math.floor((day - 1) / 5))] += t.amount;
  }
  const spendVolatility = cv(buckets);

  // 6. incomeVolatility: CV of credit amounts
  const incomeVolatility = credits.length > 0 ? cv(credits.map((t) => t.amount)) : 0;

  // 7. categoryConcentration: HHI over debit categories
  const byCat = new Map<string, number>();
  for (const t of debits) byCat.set(t.category, (byCat.get(t.category) ?? 0) + t.amount);
  let categoryConcentration = 0;
  if (totalDebit > 0) {
    for (const v of byCat.values()) {
      const share = v / totalDebit;
      categoryConcentration += share * share;
    }
  }

  // 8. logTxnCount
  const logTxnCount = Math.log(1 + monthTxns.length);

  return [
    savingsRate,
    salaryRegularity,
    emiToIncomeRatio,
    momDebitTrend,
    spendVolatility,
    incomeVolatility,
    categoryConcentration,
    logTxnCount,
  ];
}

/**
 * Label: did this customer MISS an EMI in `month`?
 * Deterministic heuristic:
 *   - A monthly EMI cadence exists: at least 2 EMI debits in the previous
 *     3 calendar months (excluding `month` itself).
 *   - No EMI debit occurs in `month`.
 * This handles CONSECUTIVE misses (skipping one month doesn't erase cadence)
 * while ignoring one-off EMIs (e.g. a completed loan).
 */
export function missedEmiInMonth(txns: Transaction[], month: string): boolean {
  const [y, m] = month.split("-").map(Number);
  const prev1 = monthKey(new Date(Date.UTC(y, m - 2, 1)));
  const prev2 = monthKey(new Date(Date.UTC(y, m - 3, 1)));
  const prev3 = monthKey(new Date(Date.UTC(y, m - 4, 1)));

  const emiDebitsIn = (k: string) =>
    txns.filter((t) => t.type === "debit" && t.category === "emi" && monthKey(t.timestamp) === k);

  if (emiDebitsIn(month).length > 0) return false; // paid on time

  const cadenceCount =
    emiDebitsIn(prev1).length + emiDebitsIn(prev2).length + emiDebitsIn(prev3).length;
  return cadenceCount >= 2;
}

/**
 * Build the full leakage-free training dataset.
 * For each customer, for each month m with a successor month m+1 in the data:
 *   features = extractFeatures(month m txns, debitTotal(month m-1))
 *   label    = missedEmiInMonth(all customer txns, month m+1)
 */
export function buildRiskDataset(txns: Transaction[]): RiskRow[] {
  const byCustomer = new Map<string, Transaction[]>();
  for (const t of txns) {
    const arr = byCustomer.get(t.customerId);
    if (arr) arr.push(t);
    else byCustomer.set(t.customerId, [t]);
  }

  const rows: RiskRow[] = [];
  for (const [customerId, custTxns] of byCustomer) {
    const byMonth = groupByMonth(custTxns);
    const months = [...byMonth.keys()].sort();
    const debitTotal = (k: string) =>
      (byMonth.get(k) ?? [])
        .filter((t) => t.type === "debit")
        .reduce((a, t) => a + t.amount, 0);

    for (let i = 0; i < months.length - 1; i++) {
      const m = months[i];
      const mNext = months[i + 1];
      // Only consecutive months — a gap breaks the label semantics
      if (nextMonthKey(m) !== mNext) continue;
      const prevDebit = i > 0 ? debitTotal(months[i - 1]) : null;
      rows.push({
        customerId,
        monthKey: m,
        labelMonthKey: mNext,
        features: extractFeatures(byMonth.get(m) ?? [], prevDebit),
        label: missedEmiInMonth(custTxns, mNext) ? 1 : 0,
      });
    }
  }
  return rows;
}

