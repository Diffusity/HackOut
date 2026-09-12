import { getTransactions } from "../data";
import { checkConsent } from "./checkConsent";
import { ToolResult, Anomaly, AnomalyReport } from "../types";

export function detectAnomalies(customerId: string): ToolResult<AnomalyReport> {
  const consentResult = checkConsent(customerId);
  const reasonTrace: string[] = [];

  if (!consentResult.output.consentGranted) {
    reasonTrace.push("consent=denied (Cannot detect anomalies without transaction data)");
    return {
      toolName: "detectAnomalies",
      output: {
        customerId,
        anomalies: [],
        overallRiskScore: 0,
        reasonTrace,
      },
    };
  }

  reasonTrace.push(`consent=granted`);

  const allTxns = getTransactions().filter((t) => t.customerId === customerId);
  const sortedTxns = [...allTxns].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  const anomalies: Anomaly[] = [];
  let riskScore = 0;

  if (sortedTxns.length === 0) {
    reasonTrace.push("No transactions found to analyze.");
    return {
      toolName: "detectAnomalies",
      output: { customerId, anomalies, overallRiskScore: 0, reasonTrace },
    };
  }

  // 1. Unusual merchant
  const debits = sortedTxns.filter(t => t.type === "debit");
  if (debits.length > 0) {
    const avgDebit = debits.reduce((sum, t) => sum + t.amount, 0) / debits.length;
    const merchants = new Set<string>();
    
    for (const t of debits) {
      if (t.merchant && !merchants.has(t.merchant)) {
        if (t.amount > Math.max(avgDebit * 5, 5000) && merchants.size > 0) { // High threshold
          anomalies.push({
            type: "unusual_merchant",
            severity: "high",
            description: `First time transaction at ${t.merchant} for suspiciously high amount (₹${t.amount}).`,
            txnId: t.txnId
          });
          riskScore += 40;
          reasonTrace.push(`Rule unusual_merchant fired: First txn at ${t.merchant} for ₹${t.amount} > max(5x average, 5000)`);
        }
      }
      if (t.merchant) merchants.add(t.merchant);
    }
    if (!anomalies.some(a => a.type === "unusual_merchant")) {
      reasonTrace.push("Rule unusual_merchant evaluated: No high-value unfamiliar merchants detected.");
    }
  }

  // 2. Large withdrawal
  const atmWithdrawals = debits.filter(t => t.merchant === "ATM Withdrawal" || t.mode === "ATM");
  const credits = sortedTxns.filter(t => t.type === "credit");
  const totalInflow = credits.reduce((sum, t) => sum + t.amount, 0);
  const estimatedMonthlyIncome = totalInflow > 0 ? totalInflow / (credits.length || 1) * 2 : 20000;

  for (const t of atmWithdrawals) {
    if (t.amount > estimatedMonthlyIncome * 0.5 && t.amount > 10000) {
      anomalies.push({
        type: "large_withdrawal",
        severity: "medium",
        description: `Large ATM withdrawal of ₹${t.amount}.`,
        txnId: t.txnId
      });
      riskScore += 30;
      reasonTrace.push(`Rule large_withdrawal fired: ATM withdrawal ₹${t.amount} > 50% of estimated monthly income.`);
    }
  }
  if (!anomalies.some(a => a.type === "large_withdrawal")) {
    reasonTrace.push("Rule large_withdrawal evaluated: No excessive ATM withdrawals.");
  }

  // 3. Frequency spike
  const txnsByDate = new Map<string, number>();
  for (const t of sortedTxns) {
    const dateStr = t.timestamp.split("T")[0];
    txnsByDate.set(dateStr, (txnsByDate.get(dateStr) || 0) + 1);
  }
  const avgDailyTxns = sortedTxns.length / (txnsByDate.size || 1);
  for (const [dateStr, count] of txnsByDate.entries()) {
    if (count > avgDailyTxns * 3 && count > 5) {
      anomalies.push({
        type: "frequency_spike",
        severity: "medium",
        description: `Unusual transaction frequency on ${dateStr} (${count} txns).`,
        txnId: "N/A"
      });
      riskScore += 20;
      reasonTrace.push(`Rule frequency_spike fired: ${count} txns on ${dateStr} > 3x average (${avgDailyTxns.toFixed(1)}).`);
    }
  }
  if (!anomalies.some(a => a.type === "frequency_spike")) {
    reasonTrace.push("Rule frequency_spike evaluated: Daily transaction volumes within normal range.");
  }

  // 4. Category shift
  reasonTrace.push("Rule category_shift evaluated: Skipped for demo simplicity (requires dense historical data).");

  // 5. Velocity burst (≥ 2 high-value txns within 1 hour)
  const HIGH_VALUE_THRESHOLD = 5000;
  for (let i = 0; i < debits.length - 1; i++) {
    if (debits[i].amount < HIGH_VALUE_THRESHOLD) continue;
    const time1 = new Date(debits[i].timestamp).getTime();
    
    let burstFound = false;
    for (let j = i + 1; j < debits.length; j++) {
      if (debits[i].txnId === debits[j].txnId) continue;
      if (debits[j].amount < HIGH_VALUE_THRESHOLD) continue;
      const time2 = new Date(debits[j].timestamp).getTime();
      const diffHours = Math.abs(time2 - time1) / (1000 * 60 * 60);
      
      if (diffHours <= 1) {
        anomalies.push({
          type: "velocity_burst",
          severity: "high",
          description: `Multiple high-value transactions within 1 hour.`,
          txnId: debits[j].txnId
        });
        riskScore += 40;
        reasonTrace.push(`Rule velocity_burst fired: High-value txns ${debits[i].txnId} and ${debits[j].txnId} within ${diffHours.toFixed(2)} hours.`);
        burstFound = true;
        break; 
      }
    }
    if (burstFound) break; // Don't flag multiple bursts for the same sequence
  }
  if (!anomalies.some(a => a.type === "velocity_burst")) {
    reasonTrace.push("Rule velocity_burst evaluated: No rapid succession of high-value transactions.");
  }

  riskScore = Math.min(100, riskScore);

  if (riskScore >= 70) {
    reasonTrace.push(`Result: riskScore=${riskScore} (>= 70) → recommendedIntervention: HOLD + verify`);
  } else if (riskScore > 0) {
    reasonTrace.push(`Result: riskScore=${riskScore} → Anomalies detected but below critical threshold.`);
  } else {
    reasonTrace.push(`Result: riskScore=0 → No anomalies detected.`);
  }

  return {
    toolName: "detectAnomalies",
    output: {
      customerId,
      anomalies,
      overallRiskScore: riskScore,
      reasonTrace,
    },
  };
}
