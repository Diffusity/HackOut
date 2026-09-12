export const SEED = 20260912;
/**
 * Shared synthetic population (ADR-027).
 *
 * The training script and the fairness audit must agree exactly on who the
 * population is, so the generator lives here and both import it. Same seed,
 * same 6000 people, every run.
 *
 * TO USE REAL DATA: replace buildPopulation() with a loader that maps your
 * ledger into TrainingRow. Nothing downstream changes.
 */

// ---------------------------------------------------------------- RNG

/** Seeded PRNG — training must be byte-reproducible for the model card. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(SEED);

function normal(): number {
  // Box-Muller
  const u = Math.max(rand(), 1e-9);
  const v = Math.max(rand(), 1e-9);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------- population

export interface TrainingRow {
  savingsRate: number;
  emiMissCount90d: number;
  spendVolatility30d: number;
  salaryRegularityScore: number;
  monthlyIncome: number;
  monthlyExpense: number;
  /** Protected attributes — carried for auditing, never used as features */
  cityTier: 2 | 3 | 4;
  gender: "F" | "M";
  segment: "salaried" | "gig" | "self_employed";
  /** Label: did this customer enter financial distress in the next 90 days? */
  distressed: 0 | 1;
}

const POPULATION_SIZE = 6000;

export function buildPopulation(): TrainingRow[] {
  const rows: TrainingRow[] = [];

  for (let i = 0; i < POPULATION_SIZE; i++) {
    const segment: TrainingRow["segment"] =
      rand() < 0.45 ? "salaried" : rand() < 0.6 ? "gig" : "self_employed";
    const cityTier = (rand() < 0.35 ? 2 : rand() < 0.7 ? 3 : 4) as 2 | 3 | 4;
    const gender: "F" | "M" = rand() < 0.48 ? "F" : "M";

    // Income: log-normal, shifted down in smaller towns (a real pattern we must
    // be able to detect in the fairness audit rather than pretend away).
    const tierFactor = cityTier === 2 ? 1.0 : cityTier === 3 ? 0.78 : 0.6;
    const monthlyIncome = Math.round(
      clamp(Math.exp(10.2 + 0.45 * normal()) * tierFactor, 8000, 400000)
    );

    const salaryRegularityScore =
      segment === "salaried"
        ? clamp(0.85 + 0.1 * normal(), 0.4, 1)
        : segment === "gig"
          ? clamp(0.15 + 0.15 * Math.abs(normal()), 0, 0.6)
          : clamp(0.45 + 0.2 * normal(), 0, 0.9);

    const expenseRatio = clamp(0.55 + 0.18 * normal() + (segment === "gig" ? 0.06 : 0), 0.25, 1.25);
    const monthlyExpense = Math.round(monthlyIncome * expenseRatio);
    const savingsRate = clamp(1 - expenseRatio, 0, 0.85);

    const spendVolatility30d = clamp(
      (segment === "salaried" ? 0.25 : 0.5) + 0.2 * normal(),
      0.02,
      1.6
    );

    // Latent distress pressure — the data-generating process. Documented here
    // rather than hidden, so the model card can state exactly what was learned.
    const pressure =
      -1.7 +
      -3.4 * savingsRate +
      1.35 * spendVolatility30d +
      -1.1 * salaryRegularityScore +
      1.9 * Math.max(0, expenseRatio - 0.85) * 3 +
      -0.45 * (Math.log(monthlyIncome) - 10.2) +
      0.6 * normal();

    const emiMissCount90d = clamp(
      Math.round(Math.max(0, pressure + 0.8 + 0.7 * normal())),
      0,
      4
    );

    const logit = pressure + 0.95 * emiMissCount90d;
    const probability = 1 / (1 + Math.exp(-logit));
    const distressed: 0 | 1 = rand() < probability ? 1 : 0;

    rows.push({
      savingsRate,
      emiMissCount90d,
      spendVolatility30d,
      salaryRegularityScore,
      monthlyIncome,
      monthlyExpense,
      cityTier,
      gender,
      segment,
      distressed,
    });
  }

  return rows;
}

// ---------------------------------------------------------------- features

export const FEATURE_NAMES = [
  "savingsRate",
  "emiMissCount90d",
  "spendVolatility30d",
  "salaryRegularityScore",
  "logIncome",
  "expenseRatio",
] as const;

/** Required sign of each weight. This is the fair-lending guarantee. */
export const MONOTONIC_SIGNS: Record<string, 1 | -1> = {
  savingsRate: -1,
  emiMissCount90d: 1,
  spendVolatility30d: 1,
  salaryRegularityScore: -1,
  logIncome: -1,
  expenseRatio: 1,
};

export function featurize(row: {
  savingsRate: number;
  emiMissCount90d: number;
  spendVolatility30d: number;
  salaryRegularityScore: number;
  monthlyIncome: number;
  monthlyExpense: number;
}): number[] {
  const income = Math.max(1000, row.monthlyIncome);
  return [
    row.savingsRate,
    row.emiMissCount90d,
    row.spendVolatility30d,
    row.salaryRegularityScore,
    Math.log(income),
    row.monthlyExpense / income,
  ];
}

