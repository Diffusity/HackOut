import { PageShell, Section, DataTable } from "@/components/PageShell";

export const metadata = {
  title: "Compliance — DhanSathi",
  description: "How consent, explainability, auditability and data residency are implemented.",
};

export default function CompliancePage() {
  return (
    <PageShell
      title="Compliance"
      lede="Every claim on this page points at code that runs, not at an intention. Where something is demo scope rather than production scope, it says so."
    >
      <Section title="Consent (DPDP Act 2023)">
        <DataTable
          head={["Requirement", "How it works here"]}
          rows={[
            [
              "Free, specific, informed consent",
              "Three separate scopes, each stating its purpose and what is lost by withholding it.",
            ],
            [
              "Purpose limitation",
              "A tool may only read the scopes it declares; the consent check runs before any data is touched.",
            ],
            [
              "Withdrawal as easy as giving",
              "One control withdraws everything. The pipeline degrades in front of you rather than failing.",
            ],
            [
              "Record of consent",
              "Every grant and withdrawal is written to the hash-chained audit ledger with a timestamp.",
            ],
            [
              "Notice in the user's language",
              "Customer-facing narration, SMS and IVR all render in Hindi as well as English.",
            ],
          ]}
        />
        <p className="text-fg-muted">
          Demo scope: consent changes persist in a browser cookie rather than a datastore, because
          serverless instances share no memory. Production swaps the store, not the logic.
        </p>
      </Section>

      <Section title="Explainability">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong>Nothing financial is decided by the language model.</strong> Every recommendation,
            score and gate decision comes from deterministic TypeScript. The model narrates the
            result and its output is checked against the facts before it is shown.
          </li>
          <li>
            <strong>Reason traces</strong> accompany every decision, name every threshold that
            fired, and are shown to the customer rather than kept for internal review.
          </li>
          <li>
            <strong>Counterfactuals.</strong> Each customer can see the smallest change that would
            alter their outcome, and ask why a specific product was not offered — the recourse
            information a lending decision is supposed to carry.
          </li>
          <li>
            <strong>Exact attributions.</strong> The distress model is additive, so the reasons
            shown are the actual arithmetic rather than an approximation.
          </li>
        </ul>
      </Section>

      <Section title="Auditability">
        <p>
          The audit log is a hash chain: each record carries the SHA-256 of the record before it.
          Altering or deleting any past entry invalidates every hash after it, and the dashboard
          verifies the chain from genesis on every load and shows the result.
        </p>
        <p className="text-fg-muted">
          Demo scope: the chain lives in process memory. Production appends the same records to
          write-once storage with the identical chaining logic.
        </p>
      </Section>

      <Section title="Anti-predatory design">
        <p>
          The wellness gate is hard-coded and sits between the recommendation and the customer. When
          a customer shows financial stress, it suppresses the offer — credit, investment and
          insurance alike — and substitutes support. The language model has no authority over it and
          cannot be prompted around it.
        </p>
        <p>
          The trained model can pull a customer into that protection but can never release one from
          it. A model failure therefore costs the bank a sale rather than costing a customer their
          safeguard.
        </p>
      </Section>

      <Section title="Data residency and minimisation">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            No customer data is sent to the language model. It receives the reason trace — derived
            facts — never raw transactions.
          </li>
          <li>
            Output is screened for Aadhaar, PAN and phone-number patterns before it reaches the
            customer.
          </li>
          <li>
            Inference is arithmetic over committed weights, executed in our own runtime. No feature
            data leaves the request.
          </li>
          <li>
            RBI data-localisation readiness: the deployment region is configuration. The only
            external call in the whole system is the optional narration call, and the product works
            without it.
          </li>
        </ul>
      </Section>

      <Section title="What we have not built">
        <ul className="list-disc space-y-1.5 pl-5 text-fg-muted">
          <li>Authentication, KYC, and real account linkage.</li>
          <li>A supervised underwriting model or an appeals workflow.</li>
          <li>Drift monitoring and scheduled model revalidation.</li>
          <li>Durable storage for the audit chain and consent records.</li>
        </ul>
        <p>
          Listing these is not a disclaimer. A team that cannot name what is missing has not
          understood what shipping this would take.
        </p>
      </Section>
    </PageShell>
  );
}
