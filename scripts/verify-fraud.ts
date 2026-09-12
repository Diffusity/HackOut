import assert from "assert";
import { detectAnomalies } from "../src/lib/tools/detectAnomalies";
import { getCustomers, getTransactions } from "../src/lib/data";
import { Transaction } from "../src/lib/types";

// Temporarily inject Vikram for tests
const vikramTransactions: Transaction[] = [
  {
    txnId: "txn_vikram_1",
    customerId: "CUST_VIKRAM",
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
    amount: 6000,
    merchant: "Random Electronics",
    category: "other",
    type: "debit",
    mode: "UPI"
  },
  {
    txnId: "txn_vikram_2",
    customerId: "CUST_VIKRAM",
    timestamp: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(), // 1.5 hours ago
    amount: 7000,
    merchant: "Random Electronics",
    category: "other",
    type: "debit",
    mode: "UPI"
  },
  {
    txnId: "txn_vikram_3",
    customerId: "CUST_VIKRAM",
    timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
    amount: 35000, // Very large withdrawal
    merchant: "ATM Withdrawal",
    category: "other",
    type: "debit",
    mode: "ATM"
  },
  {
    txnId: "txn_vikram_4",
    customerId: "CUST_VIKRAM",
    timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
    amount: 25000, // Income
    merchant: "Salary",
    category: "salary",
    type: "credit",
    mode: "NEFT"
  }
];

// Mock getTransactions / getCustomerById just for this script
const originalGetTransactions = getTransactions;
const originalGetCustomers = getCustomers;

const mockGetTransactions = () => {
  return [...originalGetTransactions(), ...vikramTransactions];
};

const mockGetCustomerById = (id: string) => {
  if (id === "CUST_VIKRAM") {
    return {
      customerId: "CUST_VIKRAM",
      name: "Vikram Demo",
      consent: { transactions: true, location: true, spendCategories: true }
    };
  }
  return originalGetCustomers().find(c => c.customerId === id);
};

import * as repo from "../src/lib/db/repository";
import { loadSnapshot } from "../src/lib/db/repository";

async function runTests() {
  console.log("Running Fraud & Anomaly Detection Tests...\n");

  await loadSnapshot();
  const snapshot = repo.currentSnapshot();
  snapshot.customers.push({
    customerId: "CUST_VIKRAM",
    name: "Vikram Demo",
    segment: "gig",
    cityTier: 2,
    preferredLanguage: "en",
    consent: { transactions: true, location: true, spendCategories: true }
  } as any);

  snapshot.transactionsByCustomer.set("CUST_VIKRAM", vikramTransactions);

  let passed = 0, failed = 0;

  // 1. Clean Customer Baseline (Priya usually has no anomalies or low risk)
  try {
    const priyaRes = detectAnomalies("CUST_PRIYA");
    if (priyaRes.output.overallRiskScore >= 70) {
      console.error("Priya reasons:", priyaRes.output.reasonTrace);
    }
    assert.ok(priyaRes.output.overallRiskScore < 70, "Priya should not trigger high risk");
    console.log("✅ Clean Customer Baseline: Passed");
    passed++;
  } catch (e: any) {
    console.error("❌ Clean customer test failed:", e.message);
    failed++;
  }

  // 2. Unconsented Customer
  try {
    const kavita = snapshot.customers.find(c => c.customerId === "CUST_KAVITA")!;
    const originalConsent = kavita.consent.transactions;
    kavita.consent.transactions = false;

    const res = detectAnomalies("CUST_KAVITA");
    assert.strictEqual(res.output.anomalies.length, 0);
    assert.ok(res.output.reasonTrace.some(r => r.includes("consent=denied")));
    console.log("✅ Consent Gated: Passed");
    passed++;
    
    // Restore
    kavita.consent.transactions = originalConsent;
  } catch (e: any) {
    console.error("❌ Consent gated test failed:", e.message);
    failed++;
  }

  // 3. Fraud Persona (Vikram)
  try {
    const res = detectAnomalies("CUST_VIKRAM");
    const anomalyTypes = res.output.anomalies.map(a => a.type);
    
    if (!anomalyTypes.includes("large_withdrawal")) {
      console.error("Vikram reasons:", res.output.reasonTrace);
    }

    assert.ok(anomalyTypes.includes("velocity_burst"), "Should detect velocity_burst");
    assert.ok(anomalyTypes.includes("large_withdrawal"), "Should detect large_withdrawal");
    assert.ok(res.output.overallRiskScore >= 70, "Vikram should trigger high risk");
    
    console.log("✅ Fraud Persona (Velocity + Withdrawal): Passed");
    passed++;
  } catch (e: any) {
    console.error("❌ Fraud persona test failed:", e.message);
    failed++;
  }

  console.log(`\nResults: ${passed} passed, ${failed} failed.`);
  process.exit(failed === 0 ? 0 : 1);
}

runTests().catch(console.error);
