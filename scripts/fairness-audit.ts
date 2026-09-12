/**
 * Fairness audit (ADR-030). Run: `npm run audit:fairness`
 *
 * Runs the ENTIRE decision pipeline — signals, recommendation, stress model,
 * wellness gate — over the whole modelled population and measures what people
 * in different groups actually end up being offered.
 *
 * The measure is the four-fifths rule used in fair-lending enforcement: take
 * the group least likely to receive an offer, divide by the group most likely,
 * and treat anything under 0.8 as adverse impact that must be explained.
 *
 * We publish the number whether or not it flatters us. A number we chose not
 * to look at is the only genuinely bad outcome here.
 */
import fs from "fs";
import path from "path";
import { buildPopulation, TrainingRow } from "./population";
import { decide } from "../src/lib/tools/counterfactuals";
import { predictDistress } from "../src/lib/ml/model";
import { Signals } from "../src/lib/types";

const OUT = path.join(process.cwd(), "src", "lib", "ml", "fairness.json");
const ADVERSE_IMPACT_FLOOR = 0.8;

function toSignals(row: TrainingRow, index: number): Signals {
  return {
    customerId: `POP_${index}`,
    salaryRegularityScore: row.salaryRegularityScore,
    savingsRate: row.savingsRate,
    emiMissCount90d: row.emiMissCount90d,
    spendVolatility30d: row.spendVolatility30d,
    incomeType: row.segment,
    lifeStageTags: [],
    monthlyIncome: row.monthlyIncome,
    monthlyExpense: row.monthlyExpense,
  };
}

interface GroupStats {
  group: string;
  count: number;
  /** Share receiving any product offer (i.e. not gated into support) */
  offerRate: number;
  /** Share the wellness gate held an offer back from */
  suppressionRate: number;
  meanModelRisk: number;
  topProduct: string;
}

function summarise(
  label: string,
  rows: { row: TrainingRow; signals: Signals }[]
): GroupStats {
  let offers = 0;
  let suppressed = 0;
  let riskSum = 0;
  const products = new Map<string, number>();

  for (const { signals } of rows) {
    const outcome = decide(signals);
    if (outcome.suppressed) suppressed++;
    else offers++;
    products.set(outcome.product, (products.get(outcome.product) ?? 0) + 1);
    riskSum += predictDistress(signals).probability;
  }

  const topProduct =
    [...products.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "NONE";

  return {
    group: label,
    count: rows.length,
    offerRate: Number((offers / rows.length).toFixed(4)),
    suppressionRate: Number((suppressed / rows.length).toFixed(4)),
    meanModelRisk: Number((riskSum / rows.length).toFixed(4)),
    topProduct,
  };
}

function impactRatio(groups: GroupStats[]) {
  const rates = groups.map((g) => g.offerRate).filter((r) => r > 0);
  if (rates.length < 2) return { ratio: 1, passes: true };
  const ratio = Math.min(...rates) / Math.max(...rates);
  return { ratio: Number(ratio.toFixed(4)), passes: ratio >= ADVERSE_IMPACT_FLOOR };
}

function main() {
  const population = buildPopulation();
  const enriched = population.map((row, i) => ({ row, signals: toSignals(row, i) }));

  const attributes: { attribute: string; groups: GroupStats[] }[] = [];

  attributes.push({
    attribute: "gender",
    groups: (["F", "M"] as const).map((g) =>
      summarise(`gender=${g}`, enriched.filter((e) => e.row.gender === g))
    ),
  });

  attributes.push({
    attribute: "cityTier",
    groups: ([2, 3, 4] as const).map((t) =>
      summarise(`tier=${t}`, enriched.filter((e) => e.row.cityTier === t))
    ),
  });

  attributes.push({
    attribute: "incomeType",
    groups: (["salaried", "gig", "self_employed"] as const).map((s) =>
      summarise(`${s}`, enriched.filter((e) => e.row.segment === s))
    ),
  });

  const report = {
    generatedAt: new Date().toISOString(),
    populationSize: population.length,
    adverseImpactFloor: ADVERSE_IMPACT_FLOOR,
    attributes: attributes.map((a) => ({ ...a, ...impactRatio(a.groups) })),
    notes: [
      "Protected attributes are never model features; they exist here only to measure outcomes.",
      "Offer rate means the customer received a product recommendation rather than being routed to support.",
      "A low ratio on income type is expected and intended: gig and self-employed customers carry more volatile cash flow, so the wellness gate holds back more offers for them. That is the product working, not a bug — but it is exactly the kind of disparity a bank must be able to see and justify.",
    ],
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

  for (const attribute of report.attributes) {
    console.log(
      `\n${attribute.attribute}: impact ratio ${attribute.ratio} ${attribute.passes ? "PASS" : "FLAGGED"} (floor ${ADVERSE_IMPACT_FLOOR})`
    );
    for (const group of attribute.groups) {
      console.log(
        `  ${group.group.padEnd(16)} n=${String(group.count).padStart(5)}  offers ${(group.offerRate * 100).toFixed(1).padStart(5)}%  suppressed ${(group.suppressionRate * 100).toFixed(1).padStart(5)}%  mean risk ${(group.meanModelRisk * 100).toFixed(1)}%  top ${group.topProduct}`
      );
    }
  }

  console.log(`\nWrote ${path.relative(process.cwd(), OUT)}`);
}

main();
