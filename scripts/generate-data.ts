/**
 * Synthetic Data Generator for DhanSathi
 * =======================================
 * Generates realistic Indian banking data for the hackathon demo.
 *
 * Run: npx tsx scripts/generate-data.ts
 *
 * Outputs:
 *   - src/data/customers.json
 *   - src/data/transactions.json
 *   - src/data/products.json
 *
 * ADR References: ADR-007 (Synthetic Bharat Data), ADR-008 (JSON Storage)
 */

import * as fs from "fs";
import * as path from "path";

// ─────────────────────────────────────────────
// Types (mirrored from src/lib/types.ts)
// ─────────────────────────────────────────────

interface Customer {
  customerId: string;
  name: string;
  segment: "salaried" | "gig" | "self_employed";
  cityTier: 2 | 3 | 4;
  preferredLanguage: "hi" | "en" | "ta" | "te" | "kn" | "bn";
  consent: {
    transactions: boolean;
    location: boolean;
    spendCategories: boolean;
  };
}

interface Transaction {
  txnId: string;
  customerId: string;
  timestamp: string; // ISO 8601
  amount: number;
  type: "credit" | "debit";
  category:
    | "salary"
    | "emi"
    | "upi_spend"
    | "bill"
    | "transfer"
    | "investment"
    | "other";
  merchant?: string;
  mode: "UPI" | "NEFT" | "IMPS" | "ATM" | "POS" | "auto_debit";
}

interface Product {
  id: string;
  name: string;
  category: "savings" | "investment" | "credit" | "insurance" | "support";
  minAmount: number;
  description: string;
}

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

let txnCounter = 0;
function nextTxnId(): string {
  txnCounter++;
  return `TXN${String(txnCounter).padStart(6, "0")}`;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function isoDate(year: number, month: number, day: number, hour = 10): string {
  const d = new Date(year, month - 1, Math.min(day, 28), hour, randomBetween(0, 59));
  return d.toISOString();
}

// Indian merchants for realistic transactions
const GROCERY_MERCHANTS = ["BigBazaar", "Reliance Fresh", "DMart", "More Supermarket", "Spencer's"];
const FOOD_MERCHANTS = ["Swiggy", "Zomato", "Domino's"];
const SHOPPING_MERCHANTS = ["Flipkart", "Amazon India", "Myntra", "Ajio"];
const ENTERTAINMENT_MERCHANTS = ["BookMyShow", "Netflix India", "Hotstar"];
const TELECOM_MERCHANTS = ["Jio Recharge", "Airtel Recharge", "Vi Recharge"];
const INSURANCE_MERCHANTS = ["LIC Premium", "HDFC Life", "ICICI Prudential"];
const UTILITY_MERCHANTS = ["Electricity Board", "Water Board", "Gas Connection", "Broadband Bill"];

// ─────────────────────────────────────────────
// Product Catalog
// ─────────────────────────────────────────────

const products: Product[] = [
  {
    id: "RD",
    name: "Recurring Deposit",
    category: "savings",
    minAmount: 500,
    description: "Save a fixed amount every month and earn guaranteed interest. Ideal for building a savings habit.",
  },
  {
    id: "SIP",
    name: "Systematic Investment Plan",
    category: "investment",
    minAmount: 500,
    description: "Invest small amounts regularly in mutual funds. Great for long-term wealth building.",
  },
  {
    id: "FD",
    name: "Fixed Deposit",
    category: "savings",
    minAmount: 10000,
    description: "Deposit a lump sum and earn higher interest. Your money is safe and grows steadily.",
  },
  {
    id: "CREDIT_CARD",
    name: "Credit Card",
    category: "credit",
    minAmount: 0,
    description: "A credit line for everyday purchases with cashback and rewards.",
  },
  {
    id: "PERSONAL_LOAN",
    name: "Personal Loan",
    category: "credit",
    minAmount: 50000,
    description: "Unsecured loan for personal needs — medical emergencies, education, or home renovation.",
  },
  {
    id: "VEHICLE_LOAN",
    name: "Vehicle Loan",
    category: "credit",
    minAmount: 100000,
    description: "Affordable financing for two-wheelers and four-wheelers with flexible EMI options.",
  },
  {
    id: "HOME_LOAN",
    name: "Home Loan",
    category: "credit",
    minAmount: 500000,
    description: "Long-term financing for buying or building your dream home.",
  },
  {
    id: "HEALTH_INSURANCE",
    name: "Health Insurance",
    category: "insurance",
    minAmount: 5000,
    description: "Comprehensive health coverage for you and your family.",
  },
  {
    id: "EMI_RESTRUCTURE",
    name: "EMI Restructuring",
    category: "support",
    minAmount: 0,
    description: "Restructure your existing EMIs to reduce monthly burden during financial stress.",
  },
];

// ─────────────────────────────────────────────
// Transaction Generator Functions
// ─────────────────────────────────────────────

/** Add a salary credit on a given day of month */
function addSalary(
  txns: Transaction[],
  customerId: string,
  year: number,
  month: number,
  amount: number,
  day = 1
): void {
  txns.push({
    txnId: nextTxnId(),
    customerId,
    timestamp: isoDate(year, month, day, randomBetween(8, 11)),
    amount,
    type: "credit",
    category: "salary",
    mode: "NEFT",
  });
}

/** Add a gig/UPI inflow on a random day */
function addGigInflow(
  txns: Transaction[],
  customerId: string,
  year: number,
  month: number,
  amount: number
): void {
  txns.push({
    txnId: nextTxnId(),
    customerId,
    timestamp: isoDate(year, month, randomBetween(1, 28), randomBetween(6, 22)),
    amount,
    type: "credit",
    category: "other",
    mode: "UPI",
  });
}

/** Add an EMI debit on a given day */
function addEMI(
  txns: Transaction[],
  customerId: string,
  year: number,
  month: number,
  amount: number,
  day = 15
): void {
  txns.push({
    txnId: nextTxnId(),
    customerId,
    timestamp: isoDate(year, month, day, 6),
    amount,
    type: "debit",
    category: "emi",
    mode: "auto_debit",
    merchant: "EMI Auto-Debit",
  });
}

/** Add investment (SIP/LIC) */
function addInvestment(
  txns: Transaction[],
  customerId: string,
  year: number,
  month: number,
  amount: number,
  merchant: string,
  day = 5
): void {
  txns.push({
    txnId: nextTxnId(),
    customerId,
    timestamp: isoDate(year, month, day, 10),
    amount,
    type: "debit",
    category: "investment",
    mode: "NEFT",
    merchant,
  });
}

/** Add utility bill */
function addBill(
  txns: Transaction[],
  customerId: string,
  year: number,
  month: number,
  amount: number,
  merchant?: string
): void {
  txns.push({
    txnId: nextTxnId(),
    customerId,
    timestamp: isoDate(year, month, randomBetween(10, 20)),
    amount,
    type: "debit",
    category: "bill",
    mode: "auto_debit",
    merchant: merchant || randomItem(UTILITY_MERCHANTS),
  });
}

/** Add UPI spend (food, shopping, entertainment) */
function addUPISpend(
  txns: Transaction[],
  customerId: string,
  year: number,
  month: number,
  amount: number,
  merchant?: string
): void {
  txns.push({
    txnId: nextTxnId(),
    customerId,
    timestamp: isoDate(year, month, randomBetween(1, 28), randomBetween(10, 22)),
    amount,
    type: "debit",
    category: "upi_spend",
    mode: "UPI",
    merchant: merchant || randomItem([...FOOD_MERCHANTS, ...GROCERY_MERCHANTS]),
  });
}

/** Add ATM withdrawal */
function addATM(
  txns: Transaction[],
  customerId: string,
  year: number,
  month: number,
  amount: number
): void {
  txns.push({
    txnId: nextTxnId(),
    customerId,
    timestamp: isoDate(year, month, randomBetween(1, 28), randomBetween(8, 20)),
    amount,
    type: "debit",
    category: "other",
    mode: "ATM",
    merchant: "ATM Withdrawal",
  });
}

/** Add POS spend */
function addPOS(
  txns: Transaction[],
  customerId: string,
  year: number,
  month: number,
  amount: number,
  merchant?: string
): void {
  txns.push({
    txnId: nextTxnId(),
    customerId,
    timestamp: isoDate(year, month, randomBetween(1, 28)),
    amount,
    type: "debit",
    category: "upi_spend",
    mode: "POS",
    merchant: merchant || randomItem(GROCERY_MERCHANTS),
  });
}

/** Add transfer */
function addTransfer(
  txns: Transaction[],
  customerId: string,
  year: number,
  month: number,
  amount: number,
  type: "credit" | "debit" = "debit"
): void {
  txns.push({
    txnId: nextTxnId(),
    customerId,
    timestamp: isoDate(year, month, randomBetween(1, 28)),
    amount,
    type,
    category: "transfer",
    mode: "IMPS",
  });
}

// ─────────────────────────────────────────────
// Generate Monthly Spending Patterns
// ─────────────────────────────────────────────

/** Generate standard monthly spending for a customer */
function generateMonthlySpending(
  txns: Transaction[],
  customerId: string,
  year: number,
  month: number,
  budget: {
    groceries: number;
    food: number;
    shopping: number;
    entertainment: number;
    telecom: number;
  },
  multiplier = 1.0 // For festival spikes
): void {
  // Groceries: 3-5 transactions per month
  const groceryCount = randomBetween(3, 5);
  for (let i = 0; i < groceryCount; i++) {
    const amt = Math.round((budget.groceries / groceryCount) * randomFloat(0.7, 1.3) * multiplier);
    addUPISpend(txns, customerId, year, month, amt, randomItem(GROCERY_MERCHANTS));
  }

  // Food delivery: 4-8 transactions
  const foodCount = randomBetween(4, 8);
  for (let i = 0; i < foodCount; i++) {
    const amt = Math.round((budget.food / foodCount) * randomFloat(0.5, 1.5) * multiplier);
    addUPISpend(txns, customerId, year, month, amt, randomItem(FOOD_MERCHANTS));
  }

  // Shopping: 1-3 transactions
  if (Math.random() > 0.3 || multiplier > 1) {
    const shopCount = multiplier > 1 ? randomBetween(3, 6) : randomBetween(1, 3);
    for (let i = 0; i < shopCount; i++) {
      const amt = Math.round((budget.shopping / 2) * randomFloat(0.5, 2.0) * multiplier);
      addUPISpend(txns, customerId, year, month, amt, randomItem(SHOPPING_MERCHANTS));
    }
  }

  // Entertainment: 0-2 transactions
  if (Math.random() > 0.4) {
    const amt = Math.round(budget.entertainment * randomFloat(0.5, 1.5) * multiplier);
    addUPISpend(txns, customerId, year, month, amt, randomItem(ENTERTAINMENT_MERCHANTS));
  }

  // Telecom recharge: 1 per month
  addBill(txns, customerId, year, month, budget.telecom, randomItem(TELECOM_MERCHANTS));
}

// ─────────────────────────────────────────────
// Demo Persona Generators
// ─────────────────────────────────────────────

// Data spans 6 months: April 2026 to September 2026
const MONTHS = [
  { year: 2026, month: 4 }, // Month 1
  { year: 2026, month: 5 }, // Month 2
  { year: 2026, month: 6 }, // Month 3
  { year: 2026, month: 7 }, // Month 4
  { year: 2026, month: 8 }, // Month 5
  { year: 2026, month: 9 }, // Month 6 (current)
];

function generatePriyaTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  const id = "CUST_PRIYA";

  for (let i = 0; i < MONTHS.length; i++) {
    const { year, month } = MONTHS[i];

    // Regular salary: ₹45,000 on 1st
    addSalary(txns, id, year, month, 45000, 1);

    // SIP investment: ₹5,000 on 5th
    addInvestment(txns, id, year, month, 5000, "SBI Mutual Fund SIP", 5);

    // LIC premium: ₹3,000 on 10th
    addInvestment(txns, id, year, month, 3000, "LIC Premium", 10);

    // Utility bills: ~₹3,000
    addBill(txns, id, year, month, randomBetween(800, 1200), "Electricity Board");
    addBill(txns, id, year, month, randomBetween(500, 800), "Broadband Bill");
    addBill(txns, id, year, month, randomBetween(400, 600), "Gas Connection");

    // Monthly spending with Diwali spike in month that would correspond to Oct/Nov equivalent
    // Since we're April-September, let's put a "festival season" spike in month 5 (August — Rakhi/Independence Day)
    const isFesMont = i === 4; // Month 5
    generateMonthlySpending(txns, id, year, month, {
      groceries: 3000,
      food: 2500,
      shopping: 1500,
      entertainment: 500,
      telecom: 399,
    }, isFesMont ? 2.5 : 1.0);

    // Occasional ATM withdrawal
    if (Math.random() > 0.5) {
      addATM(txns, id, year, month, randomBetween(1000, 3000));
    }
  }

  return txns;
}

function generateRameshTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  const id = "CUST_RAMESH";

  for (let i = 0; i < MONTHS.length; i++) {
    const { year, month } = MONTHS[i];

    // Gig income: 8-15 variable UPI inflows per month, no fixed date
    const inflowCount = randomBetween(8, 15);
    let monthlyIncome = 0;
    const targetIncome = randomBetween(25000, 40000);
    for (let j = 0; j < inflowCount; j++) {
      const amt = j === inflowCount - 1
        ? Math.max(500, targetIncome - monthlyIncome) // Last one fills the gap
        : randomBetween(500, 5000);
      monthlyIncome += amt;
      addGigInflow(txns, id, year, month, amt);
    }

    // Occasional IMPS transfers in (from family)
    if (Math.random() > 0.6) {
      addTransfer(txns, id, year, month, randomBetween(2000, 5000), "credit");
    }

    // Utility bills — sometimes late (later in month)
    addBill(txns, id, year, month, randomBetween(600, 1000), "Electricity Board");
    addBill(txns, id, year, month, randomBetween(300, 500), "Water Board");

    // Modest spending
    generateMonthlySpending(txns, id, year, month, {
      groceries: 4000,
      food: 1500,
      shopping: 800,
      entertainment: 300,
      telecom: 249,
    });

    // More ATM usage (cash-oriented)
    for (let j = 0; j < randomBetween(2, 4); j++) {
      addATM(txns, id, year, month, randomBetween(500, 2000));
    }

    // Occasional missed/late bill
    if (i >= 3 && Math.random() > 0.5) {
      // late bill represented as a bill in the last week
      txns.push({
        txnId: nextTxnId(),
        customerId: id,
        timestamp: isoDate(year, month, randomBetween(25, 28)),
        amount: randomBetween(500, 1500),
        type: "debit",
        category: "bill",
        mode: "UPI",
        merchant: randomItem(UTILITY_MERCHANTS),
      });
    }
  }

  return txns;
}

function generateSunitaTransactions(): Transaction[] {
  const txns: Transaction[] = [];
  const id = "CUST_SUNITA";

  // Sunita's shop income declines over 6 months
  const monthlyIncomes = [35000, 33000, 30000, 28000, 22000, 18000];
  const emiAmount = 8500; // Her monthly EMI
  const emiDay = 15;

  for (let i = 0; i < MONTHS.length; i++) {
    const { year, month } = MONTHS[i];
    const income = monthlyIncomes[i];

    // Shop income: 10-20 UPI inflows (daily customer payments)
    const inflowCount = randomBetween(10, 20);
    let generated = 0;
    for (let j = 0; j < inflowCount; j++) {
      const amt = j === inflowCount - 1
        ? Math.max(200, income - generated)
        : randomBetween(200, Math.round(income / 6));
      generated += amt;
      txns.push({
        txnId: nextTxnId(),
        customerId: id,
        timestamp: isoDate(year, month, randomBetween(1, 28), randomBetween(8, 20)),
        amount: amt,
        type: "credit",
        category: "other",
        mode: "UPI",
        merchant: "Shop Daily Collection",
      });
    }

    // EMI: ₹8,500 on 15th — BUT MISSED in months 5 and 6 (last 90 days)
    if (i < 4) {
      // Months 1-4: EMI paid
      addEMI(txns, id, year, month, emiAmount, emiDay);
    }
    // Months 5 & 6 (i === 4, 5): EMI MISSING — this is the key stress signal

    // Utility bills
    addBill(txns, id, year, month, randomBetween(500, 900), "Electricity Board");
    addBill(txns, id, year, month, randomBetween(200, 400), "Gas Connection");

    // Spending — declining as stress increases
    const spendMultiplier = 1.0 - (i * 0.08); // Gradually reduces
    generateMonthlySpending(txns, id, year, month, {
      groceries: 3500,
      food: 800,
      shopping: 500,
      entertainment: 200,
      telecom: 199,
    }, spendMultiplier);

    // ATM withdrawals INCREASING over time (stress signal: moving to cash)
    const atmCount = i < 3 ? randomBetween(1, 2) : randomBetween(3, 5);
    for (let j = 0; j < atmCount; j++) {
      const atmAmt = i < 3 ? randomBetween(500, 2000) : randomBetween(2000, 5000);
      addATM(txns, id, year, month, atmAmt);
    }

    // Some transfers to family (increasing under stress)
    if (i >= 3) {
      addTransfer(txns, id, year, month, randomBetween(1000, 3000));
    }
  }

  return txns;
}

// ─────────────────────────────────────────────
// Background Persona Generator
// ─────────────────────────────────────────────

interface BackgroundPersonaConfig {
  customerId: string;
  name: string;
  segment: Customer["segment"];
  cityTier: Customer["cityTier"];
  preferredLanguage: Customer["preferredLanguage"];
  consent: Customer["consent"];
  monthlyIncome: number | number[]; // Fixed or per-month array
  hasEMI: boolean;
  emiAmount?: number;
  investmentAmount?: number;
  spendProfile: "low" | "moderate" | "high";
  specialPattern?: "salary_hike" | "wedding" | "education" | "seasonal" | "growing" | "tight" | "steady" | "high_spend" | "cash_heavy" | "minimal" | "consistent" | "childcare";
}

const backgroundConfigs: BackgroundPersonaConfig[] = [
  {
    customerId: "CUST_AMIT",
    name: "Amit Patel",
    segment: "salaried",
    cityTier: 2,
    preferredLanguage: "en",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: [30000, 30000, 30000, 40000, 40000, 40000], // Salary hike in month 4
    hasEMI: false,
    investmentAmount: 2000,
    spendProfile: "moderate",
    specialPattern: "salary_hike",
  },
  {
    customerId: "CUST_NEHA",
    name: "Neha Gupta",
    segment: "salaried",
    cityTier: 2,
    preferredLanguage: "hi",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: 55000,
    hasEMI: false,
    spendProfile: "high",
    specialPattern: "wedding",
  },
  {
    customerId: "CUST_VIKRAM",
    name: "Vikram Singh",
    segment: "salaried",
    cityTier: 3,
    preferredLanguage: "hi",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: 75000,
    hasEMI: true,
    emiAmount: 12000,
    investmentAmount: 10000,
    spendProfile: "high",
    specialPattern: "education",
  },
  {
    customerId: "CUST_LAKSHMI",
    name: "Lakshmi Devi",
    segment: "self_employed",
    cityTier: 4,
    preferredLanguage: "te",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: [40000, 38000, 15000, 12000, 35000, 42000], // Seasonal harvest pattern
    hasEMI: false,
    spendProfile: "low",
    specialPattern: "seasonal",
  },
  {
    customerId: "CUST_ARJUN",
    name: "Arjun Reddy",
    segment: "gig",
    cityTier: 2,
    preferredLanguage: "te",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: [18000, 22000, 25000, 28000, 32000, 35000], // Growing income
    hasEMI: false,
    investmentAmount: 1000,
    spendProfile: "moderate",
    specialPattern: "growing",
  },
  {
    customerId: "CUST_MEENA",
    name: "Meena Kumari",
    segment: "salaried",
    cityTier: 3,
    preferredLanguage: "hi",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: 28000,
    hasEMI: true,
    emiAmount: 5000,
    spendProfile: "low",
    specialPattern: "tight",
  },
  {
    customerId: "CUST_RAJESH",
    name: "Rajesh Verma",
    segment: "self_employed",
    cityTier: 3,
    preferredLanguage: "hi",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: 35000,
    hasEMI: false,
    spendProfile: "moderate",
    specialPattern: "steady",
  },
  {
    customerId: "CUST_ANJALI",
    name: "Anjali Nair",
    segment: "salaried",
    cityTier: 2,
    preferredLanguage: "en",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: 95000,
    hasEMI: true,
    emiAmount: 15000,
    investmentAmount: 15000,
    spendProfile: "high",
    specialPattern: "high_spend",
  },
  {
    customerId: "CUST_SURESH",
    name: "Suresh Yadav",
    segment: "gig",
    cityTier: 4,
    preferredLanguage: "hi",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: 15000,
    hasEMI: false,
    spendProfile: "low",
    specialPattern: "cash_heavy",
  },
  {
    // PARTIAL CONSENT — for Consent Ledger demo
    customerId: "CUST_KAVITA",
    name: "Kavita Joshi",
    segment: "salaried",
    cityTier: 2,
    preferredLanguage: "en",
    consent: { transactions: true, location: false, spendCategories: false },
    monthlyIncome: 22000,
    hasEMI: false,
    spendProfile: "low",
    specialPattern: "minimal",
  },
  {
    customerId: "CUST_MOHAN",
    name: "Mohan Das",
    segment: "self_employed",
    cityTier: 4,
    preferredLanguage: "bn",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: 18000,
    hasEMI: false,
    spendProfile: "low",
    specialPattern: "consistent",
  },
  {
    customerId: "CUST_DEEPA",
    name: "Deepa Iyer",
    segment: "salaried",
    cityTier: 2,
    preferredLanguage: "ta",
    consent: { transactions: true, location: true, spendCategories: true },
    monthlyIncome: 52000,
    hasEMI: true,
    emiAmount: 8000,
    spendProfile: "moderate",
    specialPattern: "childcare",
  },
];

function generateBackgroundTransactions(config: BackgroundPersonaConfig): Transaction[] {
  const txns: Transaction[] = [];
  const id = config.customerId;

  const spendBudgets = {
    low: { groceries: 2000, food: 500, shopping: 300, entertainment: 100, telecom: 149 },
    moderate: { groceries: 3000, food: 1500, shopping: 1000, entertainment: 400, telecom: 299 },
    high: { groceries: 5000, food: 3000, shopping: 3000, entertainment: 800, telecom: 499 },
  };

  for (let i = 0; i < MONTHS.length; i++) {
    const { year, month } = MONTHS[i];
    const income = Array.isArray(config.monthlyIncome) ? config.monthlyIncome[i] : config.monthlyIncome;

    // Income
    if (config.segment === "salaried") {
      addSalary(txns, id, year, month, income, 1);
    } else if (config.segment === "gig") {
      const inflowCount = randomBetween(5, 12);
      let generated = 0;
      for (let j = 0; j < inflowCount; j++) {
        const amt = j === inflowCount - 1
          ? Math.max(200, income - generated)
          : randomBetween(200, Math.round(income / 4));
        generated += amt;
        addGigInflow(txns, id, year, month, amt);
      }
    } else {
      // self_employed: daily inflows
      const inflowCount = randomBetween(8, 18);
      let generated = 0;
      for (let j = 0; j < inflowCount; j++) {
        const amt = j === inflowCount - 1
          ? Math.max(100, income - generated)
          : randomBetween(100, Math.round(income / 5));
        generated += amt;
        txns.push({
          txnId: nextTxnId(),
          customerId: id,
          timestamp: isoDate(year, month, randomBetween(1, 28)),
          amount: amt,
          type: "credit",
          category: "other",
          mode: "UPI",
        });
      }
    }

    // EMI
    if (config.hasEMI && config.emiAmount) {
      addEMI(txns, id, year, month, config.emiAmount);
    }

    // Investment
    if (config.investmentAmount) {
      addInvestment(txns, id, year, month, config.investmentAmount, randomItem(INSURANCE_MERCHANTS));
    }

    // Bills
    addBill(txns, id, year, month, randomBetween(500, 1200), "Electricity Board");

    // Special patterns
    let spendMultiplier = 1.0;
    switch (config.specialPattern) {
      case "wedding":
        if (i === 2) spendMultiplier = 4.0; // Wedding month spike
        break;
      case "education":
        // High education payment every month
        addBill(txns, id, year, month, 15000, "School Fee Payment");
        break;
      case "cash_heavy":
        // Extra ATM withdrawals
        for (let j = 0; j < randomBetween(4, 8); j++) {
          addATM(txns, id, year, month, randomBetween(500, 2000));
        }
        break;
      case "childcare":
        addBill(txns, id, year, month, randomBetween(5000, 8000), "Daycare / School");
        break;
    }

    // Monthly spending
    generateMonthlySpending(txns, id, year, month, spendBudgets[config.spendProfile], spendMultiplier);

    // Occasional ATM
    if (config.specialPattern !== "cash_heavy" && Math.random() > 0.4) {
      addATM(txns, id, year, month, randomBetween(500, 3000));
    }
  }

  return txns;
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

function main(): void {
  console.log("🏦 DhanSathi Synthetic Data Generator");
  console.log("=====================================\n");

  // --- Customers ---
  const customers: Customer[] = [
    // Demo personas
    {
      customerId: "CUST_PRIYA",
      name: "Priya Sharma",
      segment: "salaried",
      cityTier: 3,
      preferredLanguage: "en",
      consent: { transactions: true, location: true, spendCategories: true },
    },
    {
      customerId: "CUST_RAMESH",
      name: "Ramesh Kumar",
      segment: "gig",
      cityTier: 2,
      preferredLanguage: "hi",
      consent: { transactions: true, location: true, spendCategories: true },
    },
    {
      customerId: "CUST_SUNITA",
      name: "Sunita Devi",
      segment: "self_employed",
      cityTier: 3,
      preferredLanguage: "hi",
      consent: { transactions: true, location: true, spendCategories: true },
    },
    // Background personas
    ...backgroundConfigs.map((c) => ({
      customerId: c.customerId,
      name: c.name,
      segment: c.segment,
      cityTier: c.cityTier,
      preferredLanguage: c.preferredLanguage,
      consent: c.consent,
    })),
  ];

  console.log(`✅ Generated ${customers.length} customers`);

  // --- Transactions ---
  const allTransactions: Transaction[] = [];

  // Demo personas
  allTransactions.push(...generatePriyaTransactions());
  console.log(`  → Priya: ${allTransactions.length} transactions`);

  const priyaCount = allTransactions.length;
  allTransactions.push(...generateRameshTransactions());
  console.log(`  → Ramesh: ${allTransactions.length - priyaCount} transactions`);

  const rameshCount = allTransactions.length;
  allTransactions.push(...generateSunitaTransactions());
  console.log(`  → Sunita: ${allTransactions.length - rameshCount} transactions`);

  // Background personas
  const sunitaCount = allTransactions.length;
  for (const config of backgroundConfigs) {
    allTransactions.push(...generateBackgroundTransactions(config));
  }
  console.log(`  → Background: ${allTransactions.length - sunitaCount} transactions`);

  console.log(`\n✅ Total transactions: ${allTransactions.length}`);

  // --- Sort transactions by timestamp ---
  allTransactions.sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // --- Write files ---
  const dataDir = path.join(__dirname, "..", "src", "data");
  fs.mkdirSync(dataDir, { recursive: true });

  fs.writeFileSync(
    path.join(dataDir, "customers.json"),
    JSON.stringify(customers, null, 2)
  );
  console.log("📁 Written: src/data/customers.json");

  fs.writeFileSync(
    path.join(dataDir, "transactions.json"),
    JSON.stringify(allTransactions, null, 2)
  );
  console.log("📁 Written: src/data/transactions.json");

  fs.writeFileSync(
    path.join(dataDir, "products.json"),
    JSON.stringify(products, null, 2)
  );
  console.log("📁 Written: src/data/products.json");

  // --- Verification summary ---
  console.log("\n📊 Verification Summary:");
  console.log(`   Customers: ${customers.length}`);
  console.log(`   Transactions: ${allTransactions.length}`);
  console.log(`   Products: ${products.length}`);
  console.log(`   Date range: ${allTransactions[0].timestamp} → ${allTransactions[allTransactions.length - 1].timestamp}`);

  // Check Sunita's EMI pattern
  const sunitaEMIs = allTransactions.filter(
    (t) => t.customerId === "CUST_SUNITA" && t.category === "emi"
  );
  console.log(`   Sunita EMIs found: ${sunitaEMIs.length} (should be 4 — months 1-4 paid, months 5-6 MISSED)`);

  // Check Priya's salary pattern
  const priyaSalaries = allTransactions.filter(
    (t) => t.customerId === "CUST_PRIYA" && t.category === "salary"
  );
  console.log(`   Priya salaries found: ${priyaSalaries.length} (should be 6)`);

  // Check Kavita's consent
  const kavita = customers.find((c) => c.customerId === "CUST_KAVITA");
  console.log(`   Kavita consent.location: ${kavita?.consent.location} (should be false)`);

  console.log("\n✅ Data generation complete!");
}

main();
