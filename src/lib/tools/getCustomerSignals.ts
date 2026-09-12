import { getCustomerById, getTransactionsForCustomer } from "../data";
import { Signals, ToolResult, Transaction } from "../types";

/**
 * @param now Optional "as of" date (Time Machine, ADR-023). When supplied it
 * replaces the last-transaction date as the reference point for every rolling
 * window, so advancing the demo clock genuinely changes the signals.
 */
export function getCustomerSignals(customerId: string, now?: Date): ToolResult<Signals> {
  const customer = getCustomerById(customerId);
  const txns = getTransactionsForCustomer(customerId);

  if (!customer) {
    throw new Error(`Customer ${customerId} not found`);
  }

  const reasonTrace: string[] = [];

  // Sort transactions chronologically
  txns.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (txns.length === 0) {
    return {
      toolName: "getCustomerSignals",
      output: {
        customerId,
        salaryRegularityScore: 0,
        savingsRate: 0,
        emiMissCount90d: 0,
        spendVolatility30d: 0,
        incomeType: customer.segment,
        lifeStageTags: [],
        monthlyIncome: 0,
        monthlyExpense: 0,
      },
      reasonTrace: ["No transactions found."],
      confidence: 1.0,
      timestamp: new Date(),
    };
  }

  const startDate = new Date(txns[0].timestamp);
  const lastTxnDate = new Date(txns[txns.length - 1].timestamp);
  // Reference point for all rolling windows. Defaults to the last transaction
  // so existing behaviour/tests are unchanged when no clock is injected.
  const endDate = now && now.getTime() > lastTxnDate.getTime() ? now : lastTxnDate;
  const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
  const totalMonths = Math.max(1, monthsDiff);

  // 1. salaryRegularityScore
  const salaryTxns = txns.filter(t => t.category === "salary");
  const salaryMonths = new Set(salaryTxns.map(t => `${new Date(t.timestamp).getFullYear()}-${new Date(t.timestamp).getMonth()}`));
  let salaryRegularityScore = salaryMonths.size / totalMonths;

  if (salaryTxns.length > 0) {
    const avgSalary = salaryTxns.reduce((sum, t) => sum + t.amount, 0) / salaryTxns.length;
    const stdDev = Math.sqrt(salaryTxns.reduce((sum, t) => sum + Math.pow(t.amount - avgSalary, 2), 0) / salaryTxns.length);
    if (stdDev < 0.1 * avgSalary) {
      salaryRegularityScore = Math.min(1.0, salaryRegularityScore + 0.1);
    }
    reasonTrace.push(`salary_regularity=${salaryRegularityScore.toFixed(2)} (${salaryMonths.size}/${totalMonths} months with consistent salary of ~₹${Math.round(avgSalary).toLocaleString()})`);
  } else {
    reasonTrace.push(`salary_regularity=0.00 (No salary transactions detected)`);
  }

  // 2. savingsRate
  const totalCredits = txns.filter(t => t.type === "credit").reduce((sum, t) => sum + t.amount, 0);
  const totalDebits = txns.filter(t => t.type === "debit").reduce((sum, t) => sum + t.amount, 0);
  let savingsRate = totalCredits > 0 ? (totalCredits - totalDebits) / totalCredits : 0;
  savingsRate = Math.max(0, Math.min(1, savingsRate)); // clamp
  reasonTrace.push(`savings_rate=${savingsRate.toFixed(2)} (saved ₹${Math.max(0, totalCredits - totalDebits).toLocaleString()} of ₹${totalCredits.toLocaleString()} total income)`);

  const monthlyIncome = Math.round(totalCredits / totalMonths);
  const monthlyExpense = Math.round(totalDebits / totalMonths);

  // 3. emiMissCount90d
  const ninetyDaysAgo = new Date(endDate);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  
  const allEMIs = txns.filter(t => t.category === "emi");
  const oldEMIs = allEMIs.filter(t => new Date(t.timestamp) < ninetyDaysAgo);
  const recentEMIs = allEMIs.filter(t => new Date(t.timestamp) >= ninetyDaysAgo);
  
  let emiMissCount90d = 0;
  if (oldEMIs.length > 0) {
    // Expected ~3 EMIs in the last 90 days if they had EMIs before
    const expectedEMIs = 3;
    emiMissCount90d = Math.max(0, expectedEMIs - recentEMIs.length);
    reasonTrace.push(`emi_miss_count_90d=${emiMissCount90d} (EMIs paid in earlier months, expected 3 in last 90 days but found ${recentEMIs.length})`);
  } else if (recentEMIs.length > 0) {
    reasonTrace.push(`emi_miss_count_90d=0 (Active EMIs detected, no historical misses)`);
  } else {
    reasonTrace.push(`emi_miss_count_90d=0 (No EMI history)`);
  }

  // 4. spendVolatility30d
  const thirtyDaysAgo = new Date(endDate);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  
  const recentDebits = txns.filter(t => t.type === "debit" && new Date(t.timestamp) >= thirtyDaysAgo);
  const weeklySpends = [0, 0, 0, 0];
  recentDebits.forEach(t => {
    const diffDays = Math.floor((endDate.getTime() - new Date(t.timestamp).getTime()) / (1000 * 60 * 60 * 24));
    const weekIndex = Math.min(3, Math.floor(diffDays / 7));
    weeklySpends[3 - weekIndex] += t.amount;
  });

  let spendVolatility30d = 0;
  const avgWeekly = weeklySpends.reduce((a, b) => a + b, 0) / 4;
  if (avgWeekly > 0) {
    const stdDevWeek = Math.sqrt(weeklySpends.reduce((sum, val) => sum + Math.pow(val - avgWeekly, 2), 0) / 4);
    spendVolatility30d = stdDevWeek / avgWeekly;
    reasonTrace.push(`spend_volatility_30d=${spendVolatility30d.toFixed(2)} (week-to-week spend varied by ±${Math.round(spendVolatility30d * 100)}% of the average weekly spend over the last 30 days)`);
  } else {
    reasonTrace.push(`spend_volatility_30d=0.00 (no significant spend in last 30 days)`);
  }

  // 5. incomeType
  let incomeType = customer.segment;
  if (salaryRegularityScore > 0.7) {
    incomeType = "salaried";
    reasonTrace.push(`income_type=salaried (regular salary pattern overrides profile segment if different)`);
  } else {
    reasonTrace.push(`income_type=${incomeType} (based on profile and transaction patterns)`);
  }

  // 6. lifeStageTags
  const tags = new Set<string>();
  if (savingsRate > 0.2) tags.add("disciplined_saver");
  if (savingsRate > 0.4) tags.add("high_saver");
  if (txns.some(t => t.category === "investment")) tags.add("active_investor");
  if (emiMissCount90d >= 2) tags.add("financially_stressed");
  if (salaryRegularityScore > 0.8) tags.add("stable_income");
  
  // Salary hike check (first 3 months vs last 3 months)
  if (salaryMonths.size >= 4) {
    const early = salaryTxns.filter(t => new Date(t.timestamp) < ninetyDaysAgo);
    const late = salaryTxns.filter(t => new Date(t.timestamp) >= ninetyDaysAgo);
    if (early.length > 0 && late.length > 0) {
      const avgEarly = early.reduce((sum, t) => sum + t.amount, 0) / early.length;
      const avgLate = late.reduce((sum, t) => sum + t.amount, 0) / late.length;
      if (avgLate > avgEarly * 1.2) {
        tags.add("recent_salary_hike");
      }
    }
  }

  // Festival/Wedding spender check
  const monthlyTotals = new Map<string, number>();
  txns.filter(t => t.type === "debit").forEach(t => {
    const key = `${new Date(t.timestamp).getFullYear()}-${new Date(t.timestamp).getMonth()}`;
    monthlyTotals.set(key, (monthlyTotals.get(key) || 0) + t.amount);
  });
  if (monthlyTotals.size > 2) {
    const avgMonthlyDebit = Array.from(monthlyTotals.values()).reduce((a, b) => a + b, 0) / monthlyTotals.size;
    if (Array.from(monthlyTotals.values()).some(val => val > avgMonthlyDebit * 2)) {
      tags.add("festival_spender");
    }
  }

  const lifeStageTags = Array.from(tags);
  reasonTrace.push(`life_stage_tags=[${lifeStageTags.join(", ")}]`);

  return {
    toolName: "getCustomerSignals",
    output: {
      customerId,
      salaryRegularityScore,
      savingsRate,
      emiMissCount90d,
      spendVolatility30d,
      incomeType,
      lifeStageTags,
      monthlyIncome,
      monthlyExpense,
    },
    reasonTrace,
    confidence: 1.0,
    timestamp: new Date(),
  };
}
