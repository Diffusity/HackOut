import { PageShell, Section, DataTable } from "@/components/PageShell";
import { Badge } from "@/components/ui/badge";
import { getResidency } from "@/lib/db/client";

export const metadata = {
  title: "Compliance — DhanSathi",
  description: "How consent, explainability, auditability and data residency are implemented.",
};

export const dynamic = "force-dynamic";

export default function CompliancePage() {
  const residency = getResidency();

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
              "Every grant and withdrawal is a row in an append-only consent ledger with its purpose and timestamp, and is also sealed into the hash-chained audit log.",
            ],
            [
              "Notice in the user's language",
              "Customer-facing narration, SMS and IVR all render in Hindi as well as English.",
            ],
          ]}
        />
        <p className="text-fg-muted">
          Consent is an <strong>append-only ledger</strong>, not a mutable column: every grant and
          withdrawal is a row with its purpose and timestamp, so the question a regulator actually
          asks — what had this customer consented to at the moment we made that decision? — has an
          answer. Without a database configured it degrades to a browser cookie and the app says so.
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
        <p>
          The chain is <strong>durable</strong>. Records are written to Postgres, each request reads
          the persisted head and continues the chain from it, and the write is idempotent on the hash
          so a retried request cannot fork it. The verification you see on the dashboard recomputes
          the whole chain from genesis in the database, not in memory.
        </p>
        <p className="text-fg-muted">
          Production would additionally append to write-once storage and revoke UPDATE and DELETE on
          the table at the role level. The chaining logic does not change.
        </p>
      </Section>

      <Section title="Lending disclosures (RBI)">
        <DataTable
          head={["Obligation", "How it works here"]}
          rows={[
            [
              "Key Facts Statement before sanction",
              "Every loan offer issues a full KFS with a unique proposal number, Part 1 rows 1-10, Part 2 qualitative information and a stated validity window.",
            ],
            [
              "APR as the annual cost of credit",
              "Computed by internal rate of return over the net amount actually disbursed, with every lender and third-party charge included. Both annualisation conventions are published.",
            ],
            [
              "APR computation sheet and amortisation schedule",
              "Annex B figures and the full instalment-by-instalment schedule are on the statement, not available on request.",
            ],
            [
              "Undisclosed charges may not be levied",
              "Fees are itemised on the KFS and split between the lender and third parties. The stored document is the one that binds.",
            ],
            [
              "Cooling-off period",
              "Three days for these tenors. Exit is one request: principal plus proportionate APR, zero penalty, upfront fees refunded.",
            ],
            [
              "Grievance redressal and nodal officer",
              "Named on every statement, with the escalation path to the RBI Ombudsman.",
            ],
          ]}
        />
        <p className="text-fg-muted">
          Modelled on RBI/2024-25/18 (15 April 2024) and the Guidelines on Digital Lending
          (2 September 2022). Two decisions here are ours rather than the regulator&rsquo;s: the loan is
          sized by affordability rather than by product ceiling, and we do <strong>not</strong> risk-price
          on the distress model. Charging the most fragile customer the highest rate is legal, common,
          and the exact dynamic this product exists to resist.
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

      <Section title="Where the data actually lives">
        <div className="rounded-lg border border-line bg-surface-2 p-4">
          {residency.configured ? (
            <>
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <Badge variant={residency.inIndia ? "solid" : "outline"}>
                  {residency.inIndia ? "Resident in India" : residency.location ?? "Region unknown"}
                </Badge>
                {residency.region && (
                  <span className="tnum font-mono text-xs text-fg-subtle">{residency.region}</span>
                )}
              </div>
              <div className="tnum break-all font-mono text-xs text-fg-muted">{residency.host}</div>
              <p className="mt-2 text-sm leading-relaxed">
                {residency.inIndia
                  ? `Customer data is stored in ${residency.location}, which is what RBI data localisation requires. This is read from the live connection, not written on a slide.`
                  : residency.location
                    ? `Customer data is currently stored in ${residency.location}. That is outside India, so this deployment would not satisfy RBI data localisation. The region is a project setting rather than an architectural constraint — but we are not going to claim otherwise while it reads like this.`
                    : `A database is configured, but its region cannot be determined from the hostname. We will not assert a localisation we cannot verify.`}
              </p>
            </>
          ) : (
            <>
              <Badge variant="muted">No database configured</Badge>
              <p className="mt-2 text-sm leading-relaxed">
                Running on the bundled JSON seed, so no customer data is stored anywhere. Set
                <code className="mx-1 rounded bg-surface-3 px-1.5 py-0.5">DATABASE_URL</code>
                and this panel reports the real region of the live connection.
              </p>
            </>
          )}
        </div>
      </Section>

      <Section title="Data minimisation">
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
            The only external call in the whole system is the optional narration call, and the
            product works entirely without it. Where the data rests is reported above from the live
            connection rather than asserted here.
          </li>
        </ul>
      </Section>

      <Section title="What we have not built">
        <ul className="list-disc space-y-1.5 pl-5 text-fg-muted">
          <li>Authentication, KYC, and real account linkage.</li>
          <li>A supervised underwriting model or an appeals workflow.</li>
          <li>Drift monitoring and scheduled model revalidation.</li>
          <li>Write-once storage and role-level revocation of UPDATE/DELETE on the audit table.</li>
        </ul>
        <p>
          Listing these is not a disclaimer. A team that cannot name what is missing has not
          understood what shipping this would take.
        </p>
      </Section>
    </PageShell>
  );
}
