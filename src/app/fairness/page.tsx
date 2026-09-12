import { PageShell, Section, DataTable } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import fairness from "@/lib/ml/fairness.json";

export const metadata = {
  title: "Fairness audit — DhanSathi",
  description: "Who actually gets offered what, measured across groups with the four-fifths rule.",
};

export default function FairnessPage() {
  return (
    <PageShell
      title="Fairness audit"
      lede="Algorithmic bias is not settled by a bullet point on a slide. This page runs the entire decision pipeline over the full modelled population and reports what each group is actually offered — including the result that does not flatter us."
    >
      <Section title="Method">
        <p>
          Every one of the {fairness.populationSize.toLocaleString("en-IN")} modelled customers is
          put through the real pipeline: signals, recommendation, distress model, wellness gate. We
          then apply the <strong>four-fifths rule</strong> used in fair-lending enforcement — the
          least-favoured group&rsquo;s offer rate divided by the most-favoured group&rsquo;s. Below{" "}
          {fairness.adverseImpactFloor} is adverse impact, and must be explained or fixed.
        </p>
        <p className="text-fg-muted">
          &ldquo;Offer rate&rdquo; is the share who received a product recommendation rather than
          being routed to support. Regenerate with{" "}
          <code className="rounded bg-surface-2 px-1.5 py-0.5">npm run audit:fairness</code>.
        </p>
      </Section>

      {fairness.attributes.map((attribute) => (
        <Section key={attribute.attribute} title={attribute.attribute}>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={attribute.passes ? "outline" : "solid"}>
              {attribute.passes ? "Within the four-fifths rule" : "Adverse impact flagged"}
            </Badge>
            <span className="tnum text-sm text-fg-muted">impact ratio {attribute.ratio}</span>
          </div>

          <DataTable
            head={["Group", "Customers", "Offer rate", "Held back", "Mean model risk"]}
            rows={attribute.groups.map((g) => [
              g.group,
              g.count.toLocaleString("en-IN"),
              `${(g.offerRate * 100).toFixed(1)}%`,
              `${(g.suppressionRate * 100).toFixed(1)}%`,
              `${(g.meanModelRisk * 100).toFixed(1)}%`,
            ])}
          />
        </Section>
      ))}

      <Section title="Reading the flagged result">
        <p>
          Gender and city tier sit comfortably inside the threshold. Income type does not, and we
          are not going to bury that.
        </p>
        <p>
          Gig and self-employed customers have more volatile cash flow, so the wellness gate holds
          back offers for them far more often than for salaried customers. That is the gate doing
          precisely the job it was built for — the disparity is in <em>offers withheld</em>, not in
          access to support, and the customers affected are the ones most likely to be harmed by
          badly timed credit.
        </p>
        <p>
          It is still a disparity, and it is still one a bank must be able to see, explain and
          defend. A product that suppressed this number would be less trustworthy than one that
          publishes it. The honest position: we know the gate falls unevenly, we believe the
          incidence is justified by the harm avoided, and we have made it measurable so anyone can
          disagree with us using the same numbers.
        </p>
      </Section>

      <Section title="Fairness by construction">
        <ul className="list-disc space-y-1.5 pl-5 text-fg-muted">
          {fairness.notes.map((note, i) => (
            <li key={i}>{note}</li>
          ))}
          <li>
            Monotonic constraints mean no factor can ever flip direction for a subgroup: more missed
            EMIs raises risk for everybody, always.
          </li>
          <li>
            Every customer can ask what would change their outcome and get an exact answer, which
            makes an unfair decision contestable rather than merely visible.
          </li>
        </ul>
      </Section>
    </PageShell>
  );
}
