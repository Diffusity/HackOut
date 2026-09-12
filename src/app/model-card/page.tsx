import { PageShell, Section, DataTable } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import metrics from "@/lib/ml/metrics.json";
import weights from "@/lib/ml/weights.json";

export const metadata = {
  title: "Model card — DhanSathi",
  description: "What the distress model is, how it was measured, and what it must never be used for.",
};

const FEATURE_LABELS: Record<string, string> = {
  savingsRate: "Savings rate",
  emiMissCount90d: "Missed EMIs (90 days)",
  spendVolatility30d: "Spending volatility (30 days)",
  salaryRegularityScore: "Income regularity",
  logIncome: "Income level (log)",
  expenseRatio: "Expense-to-income ratio",
};

export default function ModelCardPage() {
  const chosen = metrics.operatingPoints.find(
    (p) => p.threshold === weights.distress.escalationThreshold
  );

  return (
    <PageShell
      title="Model card"
      lede="A bank that cannot say what its model does, how well it does it, and where it fails should not be running the model. This page is the answer to those three questions, published alongside the product rather than on request."
    >
      <Section title="What it is">
        <p>
          A binary classifier estimating the probability that a customer enters financial distress —
          a missed obligation or a sharp deterioration in cash flow — within the next 90 days. It is
          an L2-regularised logistic regression, trained with{" "}
          <strong>monotonic sign constraints</strong>: each coefficient is confined to the sign that
          is defensible in advance, so the model cannot learn from noise that missing more EMIs
          makes a customer safer.
        </p>
        <div className="flex flex-wrap gap-1.5">
          <Badge variant="outline">version {weights.version}</Badge>
          <Badge variant="muted">logistic regression</Badge>
          <Badge variant="muted">{weights.features.length} features</Badge>
          <Badge variant="muted">seed {weights.seed}</Badge>
        </div>
      </Section>

      <Section title="What it is used for, and what it must never do">
        <p>
          The model <strong>proposes</strong>; the deterministic rules <strong>dispose</strong>. It
          may raise concern about a customer and pull them into support, and it may reorder what is
          shown. It may never unlock a product the rules withheld, and it may never overrule the
          wellness gate.
        </p>
        <p className="text-fg-muted">
          The asymmetry is deliberate. A wrong model costs us a sale. It cannot cost a customer
          their protection.
        </p>
        <p className="text-fg-muted">
          Not used for: credit pricing, interest rates, collections prioritisation, or any decision
          to deny an application. Those need a supervised underwriting model, an appeals process,
          and a regulator conversation this model has not had.
        </p>
      </Section>

      <Section title="Learned coefficients">
        <DataTable
          head={["Feature", "Weight", "Constrained sign", "Direction"]}
          rows={weights.features.map((f: string, i: number) => [
            FEATURE_LABELS[f] ?? f,
            weights.distress.weights[i].toFixed(4),
            (weights.monotonicSigns as Record<string, number>)[f] > 0 ? "positive" : "negative",
            weights.distress.weights[i] >= 0 ? "raises risk" : "lowers risk",
          ])}
        />
        <p className="text-fg-muted">
          Because the model is additive, a customer&rsquo;s score decomposes exactly into these
          contributions. The reasons shown on the dashboard are the real arithmetic, not a post-hoc
          approximation of a black box.
        </p>
      </Section>

      <Section title="Performance">
        <DataTable
          head={["Metric", "Value"]}
          rows={[
            ["Test AUC", metrics.testAuc],
            ["Train AUC", metrics.trainAuc],
            ["Population", metrics.populationSize.toLocaleString("en-IN")],
            ["Base distress rate", `${(metrics.positiveRate * 100).toFixed(1)}%`],
            ["Operating threshold", weights.distress.escalationThreshold],
            ["Recall at threshold", chosen ? chosen.recall : "—"],
            ["Precision at threshold", chosen ? chosen.precision : "—"],
            ["Customers flagged", chosen ? `${(chosen.flagRate * 100).toFixed(1)}%` : "—"],
          ]}
        />
        <p className="text-fg-muted">
          An AUC of {metrics.testAuc} is honest rather than impressive, and that is the point: at a{" "}
          {(metrics.positiveRate * 100).toFixed(1)}% base rate, a model claiming near-perfect
          separation would be leaking its label.
        </p>
      </Section>

      <Section title="How the threshold was chosen">
        <p>
          Not by maximising accuracy. Predicting that nobody is at risk would be{" "}
          {(100 - metrics.positiveRate * 100).toFixed(1)}% accurate and completely useless. We
          priced the two errors instead: a false positive costs one suppressed offer, a false
          negative means selling credit to someone sliding into distress. We weigh the second at{" "}
          {metrics.thresholdPolicy.falseNegativeCost}× the first and minimise total cost, subject to
          flagging no more than {Math.round(metrics.thresholdPolicy.maxFlagRate * 100)}% of
          customers so that interventions stay actionable.
        </p>
        <DataTable
          head={["Threshold", "Recall", "Precision", "Flagged", "Cost"]}
          rows={metrics.operatingPoints.map((p) => [
            p.threshold === weights.distress.escalationThreshold ? `${p.threshold} (chosen)` : p.threshold,
            p.recall,
            p.precision,
            `${(p.flagRate * 100).toFixed(1)}%`,
            p.cost,
          ])}
        />
      </Section>

      <Section title="Calibration">
        <p className="text-fg-muted">
          Predicted probability against observed outcome, on held-out data. A well-calibrated model
          says 20% for groups that fail about 20% of the time.
        </p>
        <DataTable
          head={["Predicted band", "Mean predicted", "Observed", "Customers"]}
          rows={metrics.calibration.map((c) => [
            c.bin,
            `${(c.predicted * 100).toFixed(1)}%`,
            `${(c.observed * 100).toFixed(1)}%`,
            c.count,
          ])}
        />
      </Section>

      <Section title="Performance across groups">
        <DataTable
          head={["Cohort", "Customers", "AUC", "Base rate"]}
          rows={metrics.cohortPerformance.map((c) => [
            c.cohort,
            c.count,
            c.auc,
            `${(c.positiveRate * 100).toFixed(1)}%`,
          ])}
        />
        <p className="text-fg-muted">
          Gender and city tier are <strong>not</strong> model inputs. They are recorded solely so
          that performance and outcomes can be audited across groups. See the fairness audit for
          what the pipeline actually offers each group.
        </p>
      </Section>

      <Section title="Known limitations">
        <ul className="list-disc space-y-1.5 pl-5 text-fg-muted">
          <li>
            Trained on a synthetic population with a documented data-generating process. The demo
            personas are synthetic so the demo is reproducible; a production model needs a real
            ledger with outcome labels, and the coefficients would change.
          </li>
          <li>
            Six features. It sees no informal income, no household support, no assets held
            elsewhere — all of which matter enormously for the customers this product targets.
          </li>
          <li>
            A single threshold for everyone. A capacity-aware bank would vary it by branch or
            channel.
          </li>
          <li>
            No drift monitoring yet. Coefficients are frozen at training time and there is nothing
            watching for the population moving underneath them.
          </li>
        </ul>
      </Section>

      <Section title="Reproducing this">
        <p className="text-fg-muted">
          <code className="rounded bg-surface-2 px-1.5 py-0.5">npm run train</code> regenerates the
          weights from the seeded population and rewrites this page&rsquo;s numbers. Training runs
          in Node in a few seconds; there is no Python, no ML runtime in production, and inference
          at request time is a dot product over committed JSON.
        </p>
      </Section>
    </PageShell>
  );
}
