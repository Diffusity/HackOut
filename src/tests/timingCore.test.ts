/**
 * Deterministic tests for computeTimingCore (F13).
 * Run: npx tsx src/tests/timingCore.test.ts
 * No LLM, no network — fixtures only.
 */
import { computeTimingCore, FESTIVAL_CALENDAR, TimingInput } from "../lib/tools/computeTimingSignals";
import { Signals, Transaction } from "../lib/types";

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean) {
  if (cond) {
    pass++;
    console.log(`  ok: ${name}`);
  } else {
    fail++;
    console.error(`  FAIL: ${name}`);
  }
}

// ---- Fixture helpers ----
const signals: Signals = {
  customerId: "CUST_TEST",
  salaryRegularityScore: 0.95,
  savingsRate: 0.25,
  emiMissCount90d: 0,
  spendVolatility30d: 0.2,
  incomeType: "salaried",
  lifeStageTags: [],
  monthlyIncome: 45000,
  monthlyExpense: 33000,
};

function txn(partial: Partial<Transaction> & { timestamp: string }): Transaction {
  return {
    txnId: `T${Math.random().toString(36).slice(2, 8)}`,
    customerId: "CUST_TEST",
    amount: 1000,
    type: "debit",
    category: "upi_spend",
    mode: "UPI",
    ...partial,
  };
}

// ---- Test 1: emi_due_soon fires, highest priority ----
{
  const now = new Date("2026-09-20T10:00:00Z");
  const input: TimingInput = {
    signals: { ...signals, savingsRate: 0.05, emiMissCount90d: 1 },
    transactions: [
      txn({ timestamp: "2026-08-22T06:00:00Z", amount: 5000, category: "emi", mode: "auto_debit" }),
      txn({ timestamp: "2026-07-22T06:00:00Z", amount: 5000, category: "emi", mode: "auto_debit" }),
    ],
    now,
  };
  const out = computeTimingCore(input);
  check("R1: emi_due_soon triggers", out.trigger === "emi_due_soon");
  check("R1: urgency=now", out.urgency === "now");
  check("R1: reason mentions EMI", out.reason.toLowerCase().includes("emi"));
}

// ---- Test 2: EMI due but healthy buffer -> falls through ----
{
  const now = new Date("2026-09-20T10:00:00Z");
  const input: TimingInput = {
    signals: { ...signals, savingsRate: 0.4, emiMissCount90d: 0 },
    transactions: [
      txn({ timestamp: "2026-08-22T06:00:00Z", amount: 5000, category: "emi", mode: "auto_debit" }),
    ],
    now,
  };
  const out = computeTimingCore(input);
  check("R1: healthy customer -> emi_due_soon NOT triggered", out.trigger !== "emi_due_soon");
}

// ---- Test 3 & 4: salary_credited_recently ----
{
  const now = new Date("2026-09-05T10:00:00Z");
  const input: TimingInput = {
    signals,
    transactions: [txn({ timestamp: "2026-09-04T18:00:00Z", amount: 45000, category: "salary", type: "credit", mode: "NEFT" })],
    now,
  };
  const out = computeTimingCore(input);
  check("R2: salary_credited_recently triggers", out.trigger === "salary_credited_recently");
  check("R2: urgency=now", out.urgency === "now");
}
{
  const now = new Date("2026-09-07T10:00:00Z"); // 62h after salary
  const input: TimingInput = {
    signals,
    transactions: [txn({ timestamp: "2026-09-04T18:00:00Z", amount: 45000, category: "salary", type: "credit", mode: "NEFT" })],
    now,
  };
  const out = computeTimingCore(input);
  check("R2: salary 62h old -> not triggered", out.trigger !== "salary_credited_recently");
}

// ---- Test 5 & 6: festival_savings_window ----
{
  const now = new Date("2026-10-30T10:00:00Z"); // 9 days before Diwali 2026-11-08
  const out = computeTimingCore({ signals, transactions: [], now });
  check("R3: festival_savings_window triggers", out.trigger === "festival_savings_window");
  check("R3: urgency=soon", out.urgency === "soon");
  check("R3: names Diwali", out.reason.includes("Diwali"));
}
{
  const now = new Date("2026-10-10T10:00:00Z"); // 29 days before Diwali
  const out = computeTimingCore({ signals, transactions: [], now });
  check("R3: festival 29 days out -> not triggered", out.trigger !== "festival_savings_window");
}

// ---- Test 7 & 8: stable_savings_upgrade ----
{
  const now = new Date("2026-09-15T10:00:00Z"); // May, Jun, Jul are full prior months
  const transactions: Transaction[] = [];
  for (const month of [5, 6, 7]) {
    transactions.push(
      txn({ timestamp: new Date(Date.UTC(2026, month, 5)).toISOString(), amount: 50000, category: "salary", type: "credit", mode: "NEFT" }),
      txn({ timestamp: new Date(Date.UTC(2026, month, 12)).toISOString(), amount: 10000, category: "upi_spend", mode: "UPI" })
    );
  }
  const out = computeTimingCore({ signals, transactions, now });
  check("R4: stable_savings_upgrade triggers (80% rate x3)", out.trigger === "stable_savings_upgrade");
  check("R4: urgency=scheduled", out.urgency === "scheduled");
}
{
  const now = new Date("2026-09-15T10:00:00Z");
  const transactions: Transaction[] = [];
  for (const month of [5, 6, 7]) {
    const spend = month === 6 ? 48000 : 10000; // one month nearly all spent
    transactions.push(
      txn({ timestamp: new Date(Date.UTC(2026, month, 5)).toISOString(), amount: 50000, category: "salary", type: "credit", mode: "NEFT" }),
      txn({ timestamp: new Date(Date.UTC(2026, month, 12)).toISOString(), amount: spend, category: "upi_spend", mode: "UPI" })
    );
  }
  const out = computeTimingCore({ signals, transactions, now });
  check("R4: one weak month -> not triggered", out.trigger !== "stable_savings_upgrade");
}

// ---- Test 9 & 10: spend_category_shift ----
{
  const now = new Date("2026-09-15T10:00:00Z");
  const transactions: Transaction[] = [
    // Month A (July): all spending on "bill"
    txn({ timestamp: "2026-07-10T10:00:00Z", amount: 5000, category: "bill", mode: "UPI" }),
    txn({ timestamp: "2026-07-11T10:00:00Z", amount: 5000, category: "bill", mode: "UPI" }),
    // Month B (August): all spending on "upi_spend"
    txn({ timestamp: "2026-08-10T10:00:00Z", amount: 5000, category: "upi_spend", mode: "UPI" }),
    txn({ timestamp: "2026-08-11T10:00:00Z", amount: 5000, category: "upi_spend", mode: "UPI" }),
  ];
  const out = computeTimingCore({ signals, transactions, now });
  check("R5: spend_category_shift triggers (100% shift)", out.trigger === "spend_category_shift");
  check("R5: urgency=soon", out.urgency === "soon");
}
{
  const now = new Date("2026-09-15T10:00:00Z");
  const transactions: Transaction[] = [
    txn({ timestamp: "2026-07-10T10:00:00Z", amount: 5000, category: "bill", mode: "UPI" }),
    txn({ timestamp: "2026-07-11T10:00:00Z", amount: 5000, category: "upi_spend", mode: "UPI" }),
    txn({ timestamp: "2026-08-10T10:00:00Z", amount: 5000, category: "bill", mode: "UPI" }),
    txn({ timestamp: "2026-08-11T10:00:00Z", amount: 5000, category: "upi_spend", mode: "UPI" }),
  ];
  const out = computeTimingCore({ signals, transactions, now });
  check("R5: stable 50/50 split -> not triggered", out.trigger !== "spend_category_shift");
}

// ---- Test 11: empty history -> no trigger, scheduled ----
{
  const out = computeTimingCore({ signals, transactions: [], now: new Date("2026-09-15T10:00:00Z") });
  check("R6: empty history -> trigger=null", out.trigger === null);
  check("R6: urgency=scheduled", out.urgency === "scheduled");
}

// ---- Test 12: priority ordering (EMI beats salary) ----
{
  const now = new Date("2026-09-20T10:00:00Z");
  const input: TimingInput = {
    signals: { ...signals, savingsRate: 0.05, emiMissCount90d: 1 },
    transactions: [
      txn({ timestamp: "2026-08-22T06:00:00Z", amount: 5000, category: "emi", mode: "auto_debit" }),
      txn({ timestamp: "2026-09-19T18:00:00Z", amount: 45000, category: "salary", type: "credit", mode: "NEFT" }),
    ],
    now,
  };
  const out = computeTimingCore(input);
  check("R7: EMI outranks salary (priority order)", out.trigger === "emi_due_soon");
}

// ---- Test 13: festival calendar sanity ----
{
  const allValid = FESTIVAL_CALENDAR.every((f) => {
    const d = new Date(Date.UTC(f.year, f.month - 1, f.day));
    return !Number.isNaN(d.getTime()) && d.getUTCMonth() === f.month - 1 && d.getUTCDate() === f.day;
  });
  check("R8: festival calendar dates are valid UTC dates", allValid);
}

// ---- Summary ----
console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) {
  process.exit(1);
}
console.log("ALL DETERMINISTIC TESTS PASSED");
