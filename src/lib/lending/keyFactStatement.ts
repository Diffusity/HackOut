import { Signals, ModelVerdict } from "../types";

/**
 * Key Facts Statement and APR engine (ADR-033).
 *
 * Modelled on the RBI circular "Key Facts Statement (KFS) for Loans & Advances"
 * (RBI/2024-25/18, 15 April 2024), mandatory for retail and MSME term loans
 * sanctioned on or after 1 October 2024, and on the cooling-off provisions of
 * the Guidelines on Digital Lending (2 September 2022).
 *
 * What those require, and what this implements:
 *  - A KFS in a language the borrower understands, with a unique proposal
 *    number, issued before sanction.
 *  - An APR that is the ANNUAL COST OF CREDIT — interest plus every charge the
 *    lender levies, including third-party charges recovered from the borrower.
 *  - A computation sheet for the APR and a full amortisation schedule.
 *  - Charges not disclosed in the KFS may not later be levied.
 *  - A KFS validity window (at least three working days for tenors of seven
 *    days or more) during which the terms stand.
 *  - A cooling-off period (at least three days for those tenors) in which the
 *    borrower may exit by repaying principal plus the PROPORTIONATE APR, with
 *    no penalty.
 *
 * This is a hackathon implementation of a real regulation, not legal advice.
 * The numbers are computed honestly; a production lender would have counsel
 * review the wording and its board fix the cooling-off period.
 */

export interface FeeLine {
  label: string;
  amount: number;
  /** RBI requires fees levied by the lender to be shown separately from those recovered for third parties. */
  payableTo: "lender" | "third_party";
  /** Deducted from disbursal (so the borrower never receives it) vs paid separately */
  deductedUpfront: boolean;
}

export interface AmortisationRow {
  instalment: number;
  dueDate: string;
  openingBalance: number;
  payment: number;
  principalComponent: number;
  interestComponent: number;
  closingBalance: number;
}

export interface AprComputation {
  sanctionedAmount: number;
  netDisbursedAmount: number;
  instalmentAmount: number;
  instalmentCount: number;
  totalInterest: number;
  totalFees: number;
  totalRepayment: number;
  monthlyIrr: number;
  /** Monthly IRR x 12 */
  nominalAnnualised: number;
  /** (1 + monthly IRR)^12 - 1 — the convention we report as the APR */
  effectiveAnnualised: number;
  method: string;
}

export interface KeyFactsStatement {
  proposalNo: string;
  issuedAt: string;
  validUntil: string;
  customerId: string;
  language: "en" | "hi";

  part1: {
    loanType: string;
    sanctionedAmount: number;
    disbursalSchedule: string;
    tenorMonths: number;
    instalment: { type: string; count: number; amount: number; frequency: string; commencesOn: string };
    interestRate: number;
    rateType: "fixed" | "floating";
    fees: FeeLine[];
    totalFees: number;
    apr: number;
    contingentCharges: { label: string; terms: string }[];
  };

  part2: {
    recoveryAgentClause: string;
    grievanceRedressal: string;
    nodalOfficer: { name: string; email: string; phone: string };
    loanTransferable: boolean;
    coolingOffDays: number;
    coolingOffTerms: string;
    lspDisclosure: string;
  };

  aprComputation: AprComputation;
  amortisation: AmortisationRow[];

  affordability: {
    monthlyIncome: number;
    monthlyExpense: number;
    monthlySurplus: number;
    maxAffordableEmi: number;
    foirPercent: number;
    cappedByAffordability: boolean;
    explanation: string;
  };
}

// ---------------------------------------------------------------- pricing

/**
 * Product pricing. Deliberately NOT risk-priced on the distress model.
 *
 * Charging a higher rate to the customer the model thinks is most fragile is
 * legal, common, and exactly the dynamic this product exists to resist. The
 * model's role here is the opposite: a high score stops the offer entirely via
 * the wellness gate. Price is a flat band per product; affordability, not risk
 * premium, is what varies.
 */
const PRODUCT_TERMS: Record<string, { rate: number; tenorMonths: number; label: string; maxPrincipal: number }> = {
  PERSONAL_LOAN: { rate: 14.5, tenorMonths: 24, label: "Personal Loan (unsecured, term loan)", maxPrincipal: 500000 },
  VEHICLE_LOAN: { rate: 11.25, tenorMonths: 36, label: "Vehicle Loan (secured, term loan)", maxPrincipal: 800000 },
  HOME_LOAN: { rate: 8.75, tenorMonths: 240, label: "Home Loan (secured, term loan)", maxPrincipal: 5000000 },
};

/** Fixed obligation to income ratio — the share of income that may go to an EMI. */
const FOIR_CAP = 0.4;

export function isLendingProduct(product: string): boolean {
  return product in PRODUCT_TERMS;
}

// ---------------------------------------------------------------- maths

/** Standard reducing-balance EMI. */
export function computeEmi(principal: number, annualRatePercent: number, tenorMonths: number): number {
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return principal / tenorMonths;
  const factor = Math.pow(1 + r, tenorMonths);
  return (principal * r * factor) / (factor - 1);
}

/** Largest principal whose EMI stays within a monthly budget. */
function principalForEmi(emi: number, annualRatePercent: number, tenorMonths: number): number {
  const r = annualRatePercent / 100 / 12;
  if (r === 0) return emi * tenorMonths;
  const factor = Math.pow(1 + r, tenorMonths);
  return (emi * (factor - 1)) / (r * factor);
}

export function buildAmortisation(
  principal: number,
  annualRatePercent: number,
  tenorMonths: number,
  startDate: Date
): AmortisationRow[] {
  const emi = computeEmi(principal, annualRatePercent, tenorMonths);
  const r = annualRatePercent / 100 / 12;
  const rows: AmortisationRow[] = [];
  let balance = principal;

  for (let i = 1; i <= tenorMonths; i++) {
    const interest = balance * r;
    // The final instalment absorbs rounding so the balance closes at exactly zero.
    const payment = i === tenorMonths ? balance + interest : emi;
    const principalComponent = payment - interest;
    const closing = Math.max(0, balance - principalComponent);

    const due = new Date(startDate);
    due.setMonth(due.getMonth() + i);

    rows.push({
      instalment: i,
      dueDate: due.toISOString().slice(0, 10),
      openingBalance: round(balance),
      payment: round(payment),
      principalComponent: round(principalComponent),
      interestComponent: round(interest),
      closingBalance: round(closing),
    });

    balance = closing;
  }

  return rows;
}

/**
 * APR by internal rate of return: the monthly rate at which the net amount the
 * borrower actually receives equals the present value of everything they pay
 * back. Solved by bisection, which cannot diverge the way Newton-Raphson can on
 * the flat regions this function has.
 *
 * Fees deducted upfront reduce the net disbursal and therefore RAISE the APR
 * above the headline interest rate. That gap is the entire reason the
 * regulation exists.
 */
export function computeApr(
  netDisbursed: number,
  emi: number,
  tenorMonths: number
): { monthlyIrr: number; nominalAnnualised: number; effectiveAnnualised: number } {
  const pv = (rate: number) => {
    if (rate === 0) return emi * tenorMonths - netDisbursed;
    let total = 0;
    for (let i = 1; i <= tenorMonths; i++) total += emi / Math.pow(1 + rate, i);
    return total - netDisbursed;
  };

  let low = 0;
  let high = 2; // 200% per month is far beyond any legal product
  for (let i = 0; i < 200; i++) {
    const mid = (low + high) / 2;
    if (pv(mid) > 0) low = mid;
    else high = mid;
  }

  const monthlyIrr = (low + high) / 2;
  return {
    monthlyIrr,
    nominalAnnualised: monthlyIrr * 12 * 100,
    effectiveAnnualised: (Math.pow(1 + monthlyIrr, 12) - 1) * 100,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Working days, because the KFS validity window is expressed in working days. */
function addWorkingDays(from: Date, days: number): Date {
  const date = new Date(from);
  let added = 0;
  while (added < days) {
    date.setDate(date.getDate() + 1);
    const day = date.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return date;
}

// ---------------------------------------------------------------- KFS

export interface OfferInput {
  customerId: string;
  product: string;
  signals: Signals;
  model?: ModelVerdict | null;
  language?: "en" | "hi";
  now?: Date;
  /** Existing monthly obligations already visible in the ledger */
  existingEmi?: number;
}

export function buildKeyFactsStatement(input: OfferInput): KeyFactsStatement {
  const terms = PRODUCT_TERMS[input.product];
  if (!terms) throw new Error(`${input.product} is not a lending product`);

  const now = input.now ?? new Date();
  const { signals } = input;
  const language = input.language ?? "en";

  // ---- Affordability first, price second ----
  const monthlySurplus = Math.max(0, signals.monthlyIncome - signals.monthlyExpense);
  const foirHeadroom = signals.monthlyIncome * FOIR_CAP - (input.existingEmi ?? 0);
  const maxAffordableEmi = Math.max(0, Math.min(monthlySurplus * 0.5, foirHeadroom));

  const affordablePrincipal = principalForEmi(maxAffordableEmi, terms.rate, terms.tenorMonths);
  const principal = Math.max(
    10000,
    Math.floor(Math.min(affordablePrincipal, terms.maxPrincipal) / 1000) * 1000
  );
  const cappedByAffordability = affordablePrincipal < terms.maxPrincipal;

  // ---- Fees, itemised and split by who receives them (RBI Part 1, row 8) ----
  const processingFee = round(Math.min(principal * 0.02, 5000));
  const documentationFee = 500;
  const insurancePremium = input.product === "PERSONAL_LOAN" ? 0 : round(principal * 0.004);

  const fees: FeeLine[] = [
    { label: "Processing fee (2% of sanctioned amount, capped at ₹5,000)", amount: processingFee, payableTo: "lender", deductedUpfront: true },
    { label: "Documentation charges", amount: documentationFee, payableTo: "lender", deductedUpfront: true },
  ];
  if (insurancePremium > 0) {
    fees.push({
      label: "Credit-life insurance premium (recovered for the insurer)",
      amount: insurancePremium,
      payableTo: "third_party",
      deductedUpfront: true,
    });
  }

  const totalFees = round(fees.reduce((sum, f) => sum + f.amount, 0));
  const upfrontDeductions = round(
    fees.filter((f) => f.deductedUpfront).reduce((sum, f) => sum + f.amount, 0)
  );
  const netDisbursed = round(principal - upfrontDeductions);

  const emi = round(computeEmi(principal, terms.rate, terms.tenorMonths));
  const amortisation = buildAmortisation(principal, terms.rate, terms.tenorMonths, now);
  const totalRepayment = round(amortisation.reduce((sum, row) => sum + row.payment, 0));
  const totalInterest = round(totalRepayment - principal);

  const apr = computeApr(netDisbursed, emi, terms.tenorMonths);

  // ---- Cooling-off, per the Digital Lending Guidelines ----
  // Not less than three days for tenors of seven days or more.
  const coolingOffDays = terms.tenorMonths * 30 >= 7 ? 3 : 1;

  const firstDue = new Date(now);
  firstDue.setMonth(firstDue.getMonth() + 1);

  const aprPercent = round(apr.effectiveAnnualised);

  return {
    proposalNo: buildProposalNumber(input.customerId, input.product, now),
    issuedAt: now.toISOString(),
    // At least three working days for tenors of seven days or more.
    validUntil: addWorkingDays(now, 3).toISOString(),
    customerId: input.customerId,
    language,

    part1: {
      loanType: terms.label,
      sanctionedAmount: principal,
      disbursalSchedule: `100% in a single tranche of ₹${netDisbursed.toLocaleString("en-IN")} to the registered bank account, net of ₹${upfrontDeductions.toLocaleString("en-IN")} in upfront charges.`,
      tenorMonths: terms.tenorMonths,
      instalment: {
        type: "Equated Monthly Instalment (reducing balance)",
        count: terms.tenorMonths,
        amount: emi,
        frequency: "Monthly",
        commencesOn: firstDue.toISOString().slice(0, 10),
      },
      interestRate: terms.rate,
      rateType: "fixed",
      fees,
      totalFees,
      apr: aprPercent,
      contingentCharges: [
        { label: "Penal charges on late payment", terms: "₹500 per missed instalment. Charged as a flat fee, never capitalised into the outstanding principal." },
        { label: "Foreclosure / prepayment", terms: "Nil after the cooling-off period. Part-prepayment is permitted at any time at no charge." },
        { label: "Instrument dishonour", terms: "₹250 per returned mandate, recovering the payment-network cost only." },
        { label: "Interest rate switch", terms: "Not applicable — this is a fixed-rate loan for its full tenor." },
      ],
    },

    part2: {
      recoveryAgentClause: "Clause 9.2 of the loan agreement. Recovery contact is restricted to 08:00-19:00 IST. Agents must identify themselves and are prohibited from contacting references without the borrower's written consent.",
      grievanceRedressal: "Raise a complaint in the app, by email, or on the toll-free line. Unresolved after 30 days, escalate to the RBI Integrated Ombudsman under the RB-IOS, 2021.",
      nodalOfficer: {
        name: "Grievance Redressal Officer, DhanSathi",
        email: "grievance@dhansathi.example",
        phone: "1800-000-0000",
      },
      loanTransferable: false,
      coolingOffDays,
      coolingOffTerms: `You may exit this loan within ${coolingOffDays} days of disbursal by repaying the principal drawn plus the proportionate APR for the days you held the money. No penalty and no foreclosure charge applies.`,
      lspDisclosure: "DhanSathi is the lending service provider and digital interface. The loan is on the books of the regulated entity named in the sanction letter. No recovery agent is engaged during the cooling-off period.",
    },

    aprComputation: {
      sanctionedAmount: principal,
      netDisbursedAmount: netDisbursed,
      instalmentAmount: emi,
      instalmentCount: terms.tenorMonths,
      totalInterest,
      totalFees,
      totalRepayment,
      monthlyIrr: apr.monthlyIrr,
      nominalAnnualised: round(apr.nominalAnnualised),
      effectiveAnnualised: aprPercent,
      method:
        "APR is the internal rate of return that equates the net amount disbursed to the present value of all instalments, with every lender and third-party charge included. " +
        "We report the effective annualised figure ((1 + monthly IRR)^12 - 1); the nominal annualised figure (monthly IRR x 12) is shown alongside it so the convention is never ambiguous.",
    },

    amortisation,

    affordability: {
      monthlyIncome: signals.monthlyIncome,
      monthlyExpense: signals.monthlyExpense,
      monthlySurplus,
      maxAffordableEmi: round(maxAffordableEmi),
      foirPercent: FOIR_CAP * 100,
      cappedByAffordability,
      explanation: cappedByAffordability
        ? `Sized to what you can repay, not to what we could lend. Your instalment is capped at half your monthly surplus of ₹${monthlySurplus.toLocaleString("en-IN")} and at ${FOIR_CAP * 100}% of monthly income, which gives a maximum instalment of ₹${round(maxAffordableEmi).toLocaleString("en-IN")}. The sanctioned amount follows from that ceiling.`
        : `Your income comfortably supports this instalment; the amount is capped by our product limit rather than by your affordability.`,
    },
  };
}

/** RBI requires a unique proposal number on every KFS. */
function buildProposalNumber(customerId: string, product: string, now: Date): string {
  const stamp = now.toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const short = customerId.replace("CUST_", "").slice(0, 4).toUpperCase();
  const code = product.split("_").map((w) => w[0]).join("");
  return `DS-${code}-${short}-${stamp}`;
}

// ---------------------------------------------------------------- cooling-off

export interface CoolingOffExit {
  withinWindow: boolean;
  daysHeld: number;
  principalOutstanding: number;
  proportionateApr: number;
  penalty: number;
  totalPayable: number;
  explanation: string;
}

/**
 * What it costs to walk away. Per the Digital Lending Guidelines the borrower
 * pays principal plus the proportionate APR for the days held, and nothing else
 * — no penalty, no foreclosure charge, and no forfeiture of upfront fees.
 */
export function computeCoolingOffExit(
  kfs: KeyFactsStatement,
  disbursedAt: Date,
  exitAt: Date
): CoolingOffExit {
  const msHeld = exitAt.getTime() - disbursedAt.getTime();
  const daysHeld = Math.max(0, Math.ceil(msHeld / 86400000));
  const withinWindow = daysHeld <= kfs.part2.coolingOffDays;

  const principal = kfs.part1.sanctionedAmount;
  const aprDaily = kfs.part1.apr / 100 / 365;
  const proportionateApr = round(principal * aprDaily * daysHeld);

  return {
    withinWindow,
    daysHeld,
    principalOutstanding: principal,
    proportionateApr,
    penalty: 0,
    totalPayable: round(principal + proportionateApr),
    explanation: withinWindow
      ? `You held ₹${principal.toLocaleString("en-IN")} for ${daysHeld} day${daysHeld === 1 ? "" : "s"}. ` +
        `Exiting now costs the principal plus ₹${proportionateApr.toLocaleString("en-IN")} of proportionate APR. ` +
        `No penalty, no foreclosure charge, and the upfront fees are refunded.`
      : `The ${kfs.part2.coolingOffDays}-day cooling-off period closed after day ${kfs.part2.coolingOffDays}. ` +
        `You may still prepay in full at any time with no foreclosure charge, but the proportionate-APR exit no longer applies.`,
  };
}
