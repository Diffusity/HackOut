export interface Customer {
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

export interface Transaction {
  txnId: string;
  customerId: string;
  timestamp: string; // ISO 8601
  amount: number;
  type: "credit" | "debit";
  category: "salary" | "emi" | "upi_spend" | "bill" | "transfer" | "investment" | "other";
  merchant?: string;
  mode: "UPI" | "NEFT" | "IMPS" | "ATM" | "POS" | "auto_debit";
}

export interface Product {
  id: string;
  name: string;
  category: "savings" | "investment" | "credit" | "insurance" | "support";
  minAmount: number;
  description: string;
}

export interface Signals {
  customerId: string;
  salaryRegularityScore: number;    // 0-1
  savingsRate: number;              // 0-1
  emiMissCount90d: number;
  spendVolatility30d: number;
  incomeType: "salaried" | "gig" | "self_employed";
  lifeStageTags: string[];
  monthlyIncome: number;
  monthlyExpense: number;
}

export interface Recommendation {
  customerId: string;
  product: string;
  confidence: number;
  reasonTrace: string[];
  plainLanguageExplanation: string;
  wellnessGateStatus: "passed" | "suppressed";
}

export interface StressAlert {
  customerId: string;
  isAtRisk: boolean;
  wellnessScore: number;            // 0-100
  reasons: string[];
  recommendedIntervention: string;
  empatheticMessage: string;
}

export interface AuditEntry {
  timestamp: Date;
  customerId: string;
  action: string;
  dataAccessed: string[];
  consentVerified: boolean;
  decision: string;
  reasonTrace: string[];
}

export interface ToolResult<T = any> {
  toolName: string;
  output: T;
  reasonTrace: string[];
  confidence?: number;
  timestamp: Date;
}
