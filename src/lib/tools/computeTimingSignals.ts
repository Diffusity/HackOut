import { Signals, TimingSignals, ToolResult, Transaction } from "../types";
import { checkConsent } from "./checkConsent";
import { getCustomerSignals } from "./getCustomerSignals";
import { getTransactionsForCustomer } from "../data";

/**
 * Pure, deterministic timing engine — no LLM involved (ADR-011).
 * Answers WHEN to surface a recommendation ("at the RIGHT moment", Challenge 1).
 * The LLM may narrate the timing; it never computes it.
 */

export interface TimingInput {
  signals: Signals;
  transactions: Transaction[];
  /** Injectable clock so tests are fully deterministic */
  now: Date;
}

/** Approximate festival dates (year fixed) — deterministic demo calendar. */
export const FESTIVAL_CALENDAR: { name: string; year: number; month: number; day: number }[] = [
  { name: "Pongal", year: 2026, month: 1, day: 14 },
  { name: "Holi", year: 2026, month: 3, day: 4 },
  { name: "Eid al-Fitr", year: 2026, month: 3, day: 20 },
  { name: "Eid al-Adha", year: 2026, month: 5, day: 27 },
  { name: "Onam", year: 2026, month: 8, day: 26 },
  { name: "Diwali", year: 2026, month: 11, day: 8 },
  { name: "Christmas", year: 2026, month: 12, day: 25 },
  { name: "Pongal", year: 2027, month: 1, day: 14 },
  { name: "Holi", year: 2027, month: 3, day: 24 },
  { name: "Diwali", year: 2027, month: 10, day: 29 },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfUTCMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

function addUTCMonths(d: Date, months: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1));
}

/** Pure rule engine — exported for deterministic testing with fixtures. */
export function computeTimingCore(input: TimingInput): TimingSignals & { reasonTrace: string[] } {
  const { signals, transactions, now } = input;
  const reasonTrace: string[] = [];
  const nowMs = now.getTime();

  // ---- Rule 1: emi_due_soon (priority: stress prevention) ----
  const emiDebits = transactions.filter((t) => t.category === "emi" && t.type === "debit");
  let nextEmiDueDaysLeft: number | null = null;
  if (emiDebits.length > 0) {
    const dueDays = new Set(emiDebits.map((t) => new Date(t.timestamp).getUTCDate()));
    // Predict the next due date from the historical EMI day-of-month pattern
    let best: number | null = null;
    for (let monthOffset = 0; monthOffset <= 1; monthOffset++) {
      const base = addUTCMonths(startOfUTCMonth(now), monthOffset);
      for (const day of dueDays) {
        const due = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), day));
        if (due.getTime() >= nowMs) {
          if (best === null || due.getTime() < best) best = due.getTime();
        }
      }
    }
    if (best !== null) nextEmiDueDaysLeft = (best - nowMs) / DAY_MS;
  }
  const lowBalanceProxy = signals.savingsRate < 0.10 || signals.emiMissCount90d >= 1;
  if (nextEmiDueDaysLeft !== null) {
    reasonTrace.push(
      `emi_due_soon=${nextEmiDueDaysLeft <= 3 ? "trigger" : "not_triggered"} (next EMI due in ~${Math.ceil(nextEmiDueDaysLeft)} day(s); low-balance proxy=${lowBalanceProxy ? "yes" : "no"})`
    );
  } else {
    reasonTrace.push("emi_due_soon=not_triggered (no EMI history)");
  }
  if (nextEmiDueDaysLeft !== null && nextEmiDueDaysLeft <= 3 && lowBalanceProxy) {
    return {
      customerId: signals.customerId,
      trigger: "emi_due_soon",
      urgency: "now",
      reason: `EMI due within ${Math.max(1, Math.ceil(nextEmiDueDaysLeft))} day(s) with a low savings buffer — a proactive alert, not an offer.`,
      reasonTrace,
    };
  }

  // ---- Rule 2: salary_credited_recently ----
  const salaryCredits = transactions.filter((t) => t.category === "salary" && t.type === "credit");
  const latestSalary = salaryCredits.reduce<number | null>((max, t) => {
    const ts = new Date(t.timestamp).getTime();
    return ts <= nowMs && (max === null || ts > max) ? ts : max;
  }, null);
  const salaryHoursAgo = latestSalary !== null ? (nowMs - latestSalary) / (60 * 60 * 1000) : null;
  reasonTrace.push(
    `salary_credited_recently=${salaryHoursAgo !== null && salaryHoursAgo <= 48 ? "trigger" : "not_triggered"}${salaryHoursAgo !== null ? ` (last salary credited ${salaryHoursAgo.toFixed(0)}h ago)` : " (no salary credits)"}`
  );
  if (salaryHoursAgo !== null && salaryHoursAgo <= 48) {
    return {
      customerId: signals.customerId,
      trigger: "salary_credited_recently",
      urgency: "now",
      reason: `Salary credited ${salaryHoursAgo.toFixed(0)}h ago — savings momentum is high, ideal moment for a savings/investment nudge.`,
      reasonTrace,
    };
  }

  // ---- Rule 3: festival_savings_window ----
  const upcomingFestival = FESTIVAL_CALENDAR.find((f) => {
    const t = new Date(Date.UTC(f.year, f.month - 1, f.day)).getTime();
    return t >= nowMs && t - nowMs <= 14 * DAY_MS;
  });
  reasonTrace.push(
    `festival_savings_window=${upcomingFestival ? `trigger (${upcomingFestival.name} in ${Math.ceil((new Date(Date.UTC(upcomingFestival.year, upcomingFestival.month - 1, upcomingFestival.day)).getTime() - nowMs) / DAY_MS)} days)` : "not_triggered"}`
  );
  if (upcomingFestival) {
    return {
      customerId: signals.customerId,
      trigger: "festival_savings_window",
      urgency: "soon",
      reason: `${upcomingFestival.name} is approaching — a short-term savings goal window.`,
      reasonTrace,
    };
  }

  // RULES 4-5 CONTINUE BELOW (appended)

  // ---- Rule 4: stable_savings_upgrade (last 3 full calendar months) ----
  const currentMonthStart = startOfUTCMonth(now);
  const monthRates: { month: string; rate: number }[] = [];
  for (let i = 1; i <= 3; i++) {
    const mStart = addUTCMonths(currentMonthStart, -i);
    const mEnd = addUTCMonths(currentMonthStart, -i + 1);
    const inMonth = transactions.filter((t) => {
      const ts = new Date(t.timestamp).getTime();
      return ts >= mStart.getTime() && ts < mEnd.getTime();
    });
    const income = inMonth.filter((t) => t.type === "credit").reduce((s, t) => s + t.amount, 0);
    const expense = inMonth.filter((t) => t.type === "debit").reduce((s, t) => s + t.amount, 0);
    const rate = income > 0 ? (income - expense) / income : 0;
    monthRates.push({ month: mStart.toISOString().slice(0, 7), rate });
  }
  const allStable = monthRates.every((m) => m.rate >= 0.3);
  reasonTrace.push(
    `stable_savings_upgrade=${allStable ? "trigger" : "not_triggered"} (${monthRates.map((m) => `${m.month}: ${(m.rate * 100).toFixed(0)}%`).join(", ")})`
  );
  if (allStable) {
    return {
      customerId: signals.customerId,
      trigger: "stable_savings_upgrade",
      urgency: "scheduled",
      reason: "3 consecutive months of savings rate ≥ 30% — a good moment for an investment upgrade.",
      reasonTrace,
    };
  }

  // ---- Rule 5: spend_category_shift (last full month vs the one before) ----
  const categoryDist = (mStart: Date, mEnd: Date) => {
    const inMonth = transactions.filter((t) => {
      const ts = new Date(t.timestamp).getTime();
      return t.type === "debit" && ts >= mStart.getTime() && ts < mEnd.getTime();
    });
    const total = inMonth.reduce((s, t) => s + t.amount, 0);
    const dist: Record<string, number> = {};
    for (const t of inMonth) dist[t.category] = (dist[t.category] ?? 0) + t.amount;
    const norm: Record<string, number> = {};
    for (const [k, v] of Object.entries(dist)) norm[k] = total > 0 ? v / total : 0;
    return norm;
  };
  const prevMonthStart = addUTCMonths(currentMonthStart, -1);
  const prev2MonthStart = addUTCMonths(currentMonthStart, -2);
  const distA = categoryDist(prev2MonthStart, prevMonthStart);
  const distB = categoryDist(prevMonthStart, currentMonthStart);
  const categories = new Set([...Object.keys(distA), ...Object.keys(distB)]);
  const shift = 0.5 * [...categories].reduce((s, c) => s + Math.abs((distA[c] ?? 0) - (distB[c] ?? 0)), 0);
  reasonTrace.push(`spend_category_shift=${shift > 0.4 ? "trigger" : "not_triggered"} (distribution shift: ${(shift * 100).toFixed(0)}%)`);
  if (shift > 0.4) {
    return {
      customerId: signals.customerId,
      trigger: "spend_category_shift",
      urgency: "soon",
      reason: `Spending pattern shifted by ${(shift * 100).toFixed(0)}% month-over-month — a gentle financial check-in is due.`,
      reasonTrace,
    };
  }

  // ---- No trigger ----
  reasonTrace.push("trigger=none (no time-sensitive trigger; default scheduled cadence)");
  return {
    customerId: signals.customerId,
    trigger: null,
    urgency: "scheduled",
    reason: "No time-sensitive trigger — default recommendation cadence applies.",
    reasonTrace,
  };
}

/**
 * Consent-gated wrapper: loads real customer data and runs the pure core.
 * Injectable `now` keeps the demo and tests deterministic.
 */
export function computeTimingSignals(customerId: string, now: Date = new Date()): ToolResult<TimingSignals> {
  const consentResult = checkConsent(customerId);

  if (!consentResult.output.consentGranted) {
    return {
      toolName: "computeTimingSignals",
      output: {
        customerId,
        trigger: null,
        urgency: "scheduled",
        reason: "Consent not granted — timing analysis unavailable.",
      },
      reasonTrace: [...consentResult.reasonTrace, "timing=blocked (consent denied)"],
      confidence: 1.0,
      timestamp: new Date(),
    };
  }

  const signalsResult = getCustomerSignals(customerId);
  const core = computeTimingCore({
    signals: signalsResult.output,
    transactions: getTransactionsForCustomer(customerId),
    now,
  });

  return {
    toolName: "computeTimingSignals",
    output: {
      customerId: core.customerId,
      trigger: core.trigger,
      urgency: core.urgency,
      reason: core.reason,
    },
    reasonTrace: [...consentResult.reasonTrace, ...signalsResult.reasonTrace, ...core.reasonTrace],
    confidence: 1.0,
    timestamp: new Date(),
  };
}

