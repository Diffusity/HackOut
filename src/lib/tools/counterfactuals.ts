import { Signals } from "../types";
import { recommendProduct } from "./recommendProduct";
import { computeStressCore } from "./detectStressSignals";
import { applyWellnessGate } from "./wellnessGate";
import { productName } from "../narration";

/**
 * Counterfactual / adverse-action explainer (ADR-026).
 *
 * Lending regulators do not accept "the model decided". They require the
 * principal reasons, and — for a customer to have recourse — what would have
 * to change. Because every decision function here is pure, we can answer that
 * exactly rather than approximately: sweep one signal at a time and report the
 * smallest change that flips the outcome.
 *
 * This is a search over the real decision pipeline, not a post-hoc guess, so
 * the answer is always true by construction.
 */

export interface Counterfactual {
  feature: keyof Signals | "emiMissCount90d";
  label: string;
  currentValue: string;
  requiredValue: string;
  direction: "increase" | "decrease";
  resultingProduct: string;
  resultingProductName: string;
  narrative: string;
}

/** The complete deterministic decision: recommendation AFTER the wellness gate. */
export function decide(signals: Signals): { product: string; suppressed: boolean } {
  const base = recommendProduct(signals).output;
  const stress = computeStressCore(signals);
  const gated = applyWellnessGate(
    {
      customerId: signals.customerId,
      isAtRisk: stress.isAtRisk,
      wellnessScore: stress.wellnessScore,
      reasons: stress.reasons,
      recommendedIntervention: stress.recommendedIntervention,
      empatheticMessage: "",
    },
    base
  );
  return { product: gated.product, suppressed: gated.wellnessGateStatus === "suppressed" };
}

interface Sweep {
  feature: Counterfactual["feature"];
  label: string;
  /** Candidate values ordered by increasing distance from the current value */
  candidates: (current: Signals) => number[];
  format: (v: number) => string;
  apply: (s: Signals, v: number) => Signals;
}

function range(from: number, to: number, step: number): number[] {
  const out: number[] = [];
  for (let v = from; v <= to + 1e-9; v += step) out.push(Number(v.toFixed(4)));
  return out;
}

/** Orders candidates so the *nearest* change that flips the decision wins. */
function byDistance(values: number[], current: number): number[] {
  return [...values].sort((a, b) => Math.abs(a - current) - Math.abs(b - current));
}

const SWEEPS: Sweep[] = [
  {
    feature: "savingsRate",
    label: "savings rate",
    candidates: (s) => byDistance(range(0, 0.9, 0.01), s.savingsRate),
    format: (v) => `${Math.round(v * 100)}%`,
    apply: (s, v) => ({ ...s, savingsRate: v }),
  },
  {
    feature: "monthlyIncome",
    label: "monthly income",
    candidates: (s) => {
      const base = Math.max(5000, s.monthlyIncome);
      return byDistance(range(base * 0.4, base * 2.5, base * 0.05), s.monthlyIncome);
    },
    format: (v) => `₹${Math.round(v).toLocaleString("en-IN")}`,
    apply: (s, v) => ({ ...s, monthlyIncome: Math.round(v) }),
  },
  {
    feature: "emiMissCount90d",
    label: "missed EMIs in 90 days",
    candidates: (s) => byDistance([0, 1, 2, 3, 4], s.emiMissCount90d),
    format: (v) => `${v}`,
    apply: (s, v) => ({ ...s, emiMissCount90d: v }),
  },
  {
    feature: "salaryRegularityScore",
    label: "salary regularity",
    candidates: (s) => byDistance(range(0, 1, 0.05), s.salaryRegularityScore),
    format: (v) => `${Math.round(v * 100)}%`,
    apply: (s, v) => ({ ...s, salaryRegularityScore: v }),
  },
  {
    feature: "spendVolatility30d",
    label: "spending stability",
    candidates: (s) => byDistance(range(0, 1.5, 0.05), s.spendVolatility30d),
    format: (v) => `${Math.round(v * 100)}% week-to-week swing`,
    apply: (s, v) => ({ ...s, spendVolatility30d: v }),
  },
];

function currentValueOf(signals: Signals, sweep: Sweep): number {
  return signals[sweep.feature as keyof Signals] as number;
}

/**
 * For each signal, the smallest change that would produce a different outcome.
 * Answers the customer's real question: "what would I have to do differently?"
 */
export function explainCounterfactuals(signals: Signals, currentProduct: string): Counterfactual[] {
  const results: Counterfactual[] = [];

  for (const sweep of SWEEPS) {
    const current = currentValueOf(signals, sweep);
    for (const candidate of sweep.candidates(signals)) {
      if (Math.abs(candidate - current) < 1e-9) continue;
      const outcome = decide(sweep.apply(signals, candidate));
      if (outcome.product === currentProduct) continue;

      const direction = candidate > current ? "increase" : "decrease";
      const verb = direction === "increase" ? "rose to" : "fell to";
      results.push({
        feature: sweep.feature,
        label: sweep.label,
        currentValue: sweep.format(current),
        requiredValue: sweep.format(candidate),
        direction,
        resultingProduct: outcome.product,
        resultingProductName: productName(outcome.product),
        narrative:
          `If your ${sweep.label} ${verb} ${sweep.format(candidate)} ` +
          `(currently ${sweep.format(current)}), you would see ${productName(outcome.product)} instead` +
          (outcome.suppressed ? " — support, because the wellness gate would still hold offers back." : "."),
      });
      break; // nearest flip for this feature only
    }
  }

  return results;
}

/**
 * The adverse-action answer: "why was I NOT offered X?" — either the single
 * change that would unlock it, or an honest statement that no single change does.
 */
export function whyNot(
  signals: Signals,
  targetProduct: string
): { achievable: boolean; path: Counterfactual | null; message: string } {
  const currentOutcome = decide(signals);
  if (currentOutcome.product === targetProduct) {
    return {
      achievable: true,
      path: null,
      message: `${productName(targetProduct)} is what we are already recommending.`,
    };
  }

  let best: { cf: Counterfactual; distance: number } | null = null;

  for (const sweep of SWEEPS) {
    const current = currentValueOf(signals, sweep);
    for (const candidate of sweep.candidates(signals)) {
      if (Math.abs(candidate - current) < 1e-9) continue;
      if (decide(sweep.apply(signals, candidate)).product !== targetProduct) continue;

      // Normalised distance keeps percentages and rupees comparable.
      const scale = Math.max(Math.abs(current), 1);
      const distance = Math.abs(candidate - current) / scale;
      const direction = candidate > current ? "increase" : "decrease";
      const cf: Counterfactual = {
        feature: sweep.feature,
        label: sweep.label,
        currentValue: sweep.format(current),
        requiredValue: sweep.format(candidate),
        direction,
        resultingProduct: targetProduct,
        resultingProductName: productName(targetProduct),
        narrative:
          `${productName(targetProduct)} would be offered if your ${sweep.label} ` +
          `${direction === "increase" ? "reached" : "came down to"} ${sweep.format(candidate)} ` +
          `(currently ${sweep.format(current)}).`,
      };
      if (!best || distance < best.distance) best = { cf, distance };
      break;
    }
  }

  if (!best) {
    return {
      achievable: false,
      path: null,
      message:
        `${productName(targetProduct)} is not reachable by changing any single factor on its own. ` +
        `Your profile would need more than one change, so we are not offering it today.`,
    };
  }

  return { achievable: true, path: best.cf, message: best.cf.narrative };
}
