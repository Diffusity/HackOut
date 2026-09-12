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
  /** Consent scopes the customer withheld, so callers know what was NOT seen (ADR-031) */
  degradedScopes?: string[];
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
  model?: ModelVerdict;
}

export type TimingUrgency = "now" | "soon" | "scheduled";

export interface TimingSignals {
  customerId: string;
  /** null = no time-sensitive trigger right now */
  trigger: string | null;
  urgency: TimingUrgency;
  reason: string;
}

export interface AuditEntry {
  timestamp: Date;
  customerId: string;
  action: string;
  dataAccessed: string[];
  consentVerified: boolean;
  decision: string;
  reasonTrace: string[];
  seq?: number;
  hash?: string;
  prevHash?: string;
}

export interface ToolResult<T = any> {
  toolName: string;
  output: T;
  reasonTrace: string[];
  confidence?: number;
  timestamp: Date;
}

// ---- RiskNet ML risk model (F26, ADR-022) ----
export type RiskBand = "low" | "medium" | "high";

export interface RiskFactor {
  feature: string;
  contribution: number; // weight_i * standardized x_i
  description: string;
}

export interface RiskPrediction {
  customerId: string;
  /** P(EMI missed next month) from the from-scratch logistic regression. */
  probability: number;
  /** low < 0.33 <= medium < 0.66 <= high */
  riskBand: RiskBand;
  /** Per-prediction attributions, |contribution| descending. Sum of
   *  contributions + bias equals the logit exactly. */
  topFactors: RiskFactor[];
  modelVersion: string;
}

export interface RiskModelArtifact {
  version: string;
  featureNames: string[];
  featureDescriptions: Record<string, string>;
  means: number[];
  stds: number[];
  weights: number[];
  bias: number;
  trainingMeta: {
    generatedFromHash: string;
    datasetRows: number;
    positiveRows: number;
    hyperparams: Record<string, number | string>;
    metrics: {
      trainAccuracy: number;
      trainPrecision: number;
      trainRecall: number;
      trainAuc: number | null;
      locoCvAccuracy: number;
      locoCvAuc: number | null;
      locoCvPredictions: number;
    };
    caveat: string;
  };
}

export interface Anomaly {
  type: string;
  severity: "low" | "medium" | "high";
  description: string;
  txnId: string;
}

export interface AnomalyReport {
  customerId: string;
  anomalies: Anomaly[];
  overallRiskScore: number;
  reasonTrace: string[];
}

export type ModelVerdict = any;
export type AuditRecord = AuditEntry;
