"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "./ui/badge";
import { ArrowLeft, Check, ChevronDown, Loader2 } from "lucide-react";
import { ThemeToggle } from "./ThemeToggle";
import type { KeyFactsStatement, CoolingOffExit } from "@/lib/lending/keyFactStatement";
import type { LoanOffer } from "@/lib/lending/loanStore";

const inr = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

function Row({ label, value, emphasis }: { label: string; value: React.ReactNode; emphasis?: boolean }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-line py-2.5 last:border-0">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className={`tnum text-sm ${emphasis ? "text-base font-semibold" : "font-medium"}`}>{value}</dd>
    </div>
  );
}

function Block({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-line bg-surface p-5">
      <div className="mb-3 flex items-baseline gap-2">
        <span className="tnum font-mono text-xs text-fg-subtle">{n}</span>
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted">{title}</h2>
      </div>
      {children}
    </section>
  );
}

/**
 * The Key Facts Statement, rendered as the document the regulation describes
 * rather than as a marketing page. Dense, ordered, and it leads with the number
 * that actually matters — the APR, not the headline interest rate.
 */
export function KeyFactsView({
  initialOffer,
  initialExit,
}: {
  initialOffer: LoanOffer;
  initialExit: CoolingOffExit | null;
}) {
  const [offer, setOffer] = useState(initialOffer);
  const [exit, setExit] = useState(initialExit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scheduleOpen, setScheduleOpen] = useState(false);

  const kfs: KeyFactsStatement = offer.kfs;
  const aprGap = +(kfs.part1.apr - kfs.part1.interestRate).toFixed(2);

  const act = async (action: "accept" | "cancel") => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/loans/${offer.proposalNo}/${action}`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "That did not work.");
      } else {
        if (data.offer) setOffer(data.offer);
        if (data.exit) setExit(data.exit);
        if (data.refused) setError(data.exit?.explanation ?? "The cooling-off window has closed.");
      }
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const coolingOffEnds = offer.coolingOffEndsAt ? new Date(offer.coolingOffEndsAt) : null;
  const withinCoolingOff = offer.status === "accepted" && coolingOffEnds && coolingOffEnds > new Date();

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3 md:px-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs text-fg-muted transition-colors hover:text-fg"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Dashboard
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-10 md:px-8">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge variant="solid">Key Facts Statement</Badge>
            <Badge variant="muted">{offer.status}</Badge>
            <span className="tnum font-mono text-[11px] text-fg-subtle">{kfs.proposalNo}</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">{kfs.part1.loanType}</h1>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            Issued under the RBI circular on Key Facts Statements for Loans &amp; Advances. These
            terms stand until{" "}
            <span className="font-medium text-fg">
              {new Date(kfs.validUntil).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </span>
            . Charges not listed here cannot later be levied.
          </p>
        </div>

        {/* The headline comparison, first, because it is the one that misleads. */}
        <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">You receive</div>
            <div className="tnum mt-1 text-2xl font-semibold">{inr(kfs.aprComputation.netDisbursedAmount)}</div>
            <div className="mt-1 text-xs text-fg-muted">of {inr(kfs.part1.sanctionedAmount)} sanctioned</div>
          </div>
          <div className="rounded-lg border border-line bg-surface-2 p-4">
            <div className="text-[11px] uppercase tracking-[0.08em] text-fg-subtle">Monthly</div>
            <div className="tnum mt-1 text-2xl font-semibold">{inr(kfs.part1.instalment.amount)}</div>
            <div className="mt-1 text-xs text-fg-muted">× {kfs.part1.instalment.count} instalments</div>
          </div>
          <div className="rounded-lg border border-line-strong bg-accent p-4 text-accent-fg">
            <div className="text-[11px] uppercase tracking-[0.08em] opacity-70">APR (all-in)</div>
            <div className="tnum mt-1 text-2xl font-semibold">{kfs.part1.apr}%</div>
            <div className="mt-1 text-xs opacity-70">
              {aprGap > 0 ? `${aprGap} points above the ${kfs.part1.interestRate}% rate` : "matches the interest rate"}
            </div>
          </div>
        </section>

        {aprGap > 0 && (
          <p className="rounded-lg border border-dashed border-line-strong bg-surface p-4 text-sm leading-relaxed">
            The advertised rate is <span className="font-semibold">{kfs.part1.interestRate}%</span>, but the
            true annual cost of this credit is <span className="font-semibold">{kfs.part1.apr}%</span>, because{" "}
            {inr(kfs.part1.totalFees)} of charges come out before the money reaches you. The gap between
            those two numbers is precisely what the Key Facts Statement exists to stop lenders hiding.
          </p>
        )}

        {/* Affordability — our own constraint, stated before the terms. */}
        <Block n="—" title="How this amount was decided">
          <p className="text-sm leading-relaxed">{kfs.affordability.explanation}</p>
          <dl className="mt-3">
            <Row label="Monthly income observed" value={inr(kfs.affordability.monthlyIncome)} />
            <Row label="Monthly outgoings observed" value={inr(kfs.affordability.monthlyExpense)} />
            <Row label="Surplus" value={inr(kfs.affordability.monthlySurplus)} />
            <Row label="Maximum instalment we will lend against" value={inr(kfs.affordability.maxAffordableEmi)} emphasis />
          </dl>
        </Block>

        <Block n="Part 1" title="Interest rate and fees / charges">
          <dl>
            <Row label="1. Loan proposal number" value={<span className="font-mono text-xs">{kfs.proposalNo}</span>} />
            <Row label="2. Sanctioned amount" value={inr(kfs.part1.sanctionedAmount)} />
            <Row label="3. Disbursal schedule" value={<span className="max-w-md text-right">{kfs.part1.disbursalSchedule}</span>} />
            <Row label="4. Loan term" value={`${kfs.part1.tenorMonths} months`} />
            <Row label="5. Instalment" value={`${kfs.part1.instalment.count} × ${inr(kfs.part1.instalment.amount)}, ${kfs.part1.instalment.frequency.toLowerCase()}, from ${kfs.part1.instalment.commencesOn}`} />
            <Row label="6. Interest rate and type" value={`${kfs.part1.interestRate}% per annum, ${kfs.part1.rateType}`} />
            <Row label="7. Floating rate details" value="Not applicable — fixed for the full tenor" />
          </dl>

          <div className="mt-4">
            <div className="mb-2 text-sm text-fg-muted">8. Fees and charges</div>
            <div className="overflow-x-auto rounded-md border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-surface-2">
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">Charge</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">Payable to</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-fg-muted">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {kfs.part1.fees.map((fee) => (
                    <tr key={fee.label} className="border-b border-line last:border-0">
                      <td className="px-3 py-2">{fee.label}</td>
                      <td className="px-3 py-2 text-fg-muted">
                        {fee.payableTo === "lender" ? "The lender" : "Third party"}
                      </td>
                      <td className="tnum px-3 py-2 text-right">{inr(fee.amount)}</td>
                    </tr>
                  ))}
                  <tr className="bg-surface-2">
                    <td className="px-3 py-2 font-semibold" colSpan={2}>Total</td>
                    <td className="tnum px-3 py-2 text-right font-semibold">{inr(kfs.part1.totalFees)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <dl className="mt-3">
            <Row label="9. Annual Percentage Rate (APR)" value={`${kfs.part1.apr}%`} emphasis />
          </dl>

          <div className="mt-4">
            <div className="mb-2 text-sm text-fg-muted">10. Contingent charges</div>
            <ul className="space-y-2">
              {kfs.part1.contingentCharges.map((c) => (
                <li key={c.label} className="rounded-md bg-surface-2 p-3 text-xs leading-relaxed">
                  <span className="font-semibold">{c.label}.</span> {c.terms}
                </li>
              ))}
            </ul>
          </div>
        </Block>

        <Block n="Part 2" title="Other qualitative information">
          <dl>
            <Row label="Recovery agent engagement" value={<span className="max-w-md text-right text-xs">{kfs.part2.recoveryAgentClause}</span>} />
            <Row label="Grievance redressal" value={<span className="max-w-md text-right text-xs">{kfs.part2.grievanceRedressal}</span>} />
            <Row label="Nodal grievance officer" value={<span className="text-xs">{kfs.part2.nodalOfficer.email} · {kfs.part2.nodalOfficer.phone}</span>} />
            <Row label="Loan may be transferred or securitised" value={kfs.part2.loanTransferable ? "Yes" : "No"} />
            <Row label="Cooling-off period" value={`${kfs.part2.coolingOffDays} days`} emphasis />
            <Row label="Lending service provider" value={<span className="max-w-md text-right text-xs">{kfs.part2.lspDisclosure}</span>} />
          </dl>
          <p className="mt-3 rounded-md bg-surface-2 p-3 text-xs leading-relaxed">
            {kfs.part2.coolingOffTerms}
          </p>
        </Block>

        <Block n="Annex B" title="APR computation sheet">
          <dl>
            <Row label="Sanctioned amount" value={inr(kfs.aprComputation.sanctionedAmount)} />
            <Row label="Less: charges deducted upfront" value={`− ${inr(kfs.aprComputation.totalFees)}`} />
            <Row label="Net amount disbursed" value={inr(kfs.aprComputation.netDisbursedAmount)} emphasis />
            <Row label="Instalment" value={`${kfs.aprComputation.instalmentCount} × ${inr(kfs.aprComputation.instalmentAmount)}`} />
            <Row label="Total interest" value={inr(kfs.aprComputation.totalInterest)} />
            <Row label="Total repayment" value={inr(kfs.aprComputation.totalRepayment)} />
            <Row label="Monthly internal rate of return" value={`${(kfs.aprComputation.monthlyIrr * 100).toFixed(4)}%`} />
            <Row label="Nominal annualised (IRR × 12)" value={`${kfs.aprComputation.nominalAnnualised}%`} />
            <Row label="Effective annualised — reported APR" value={`${kfs.aprComputation.effectiveAnnualised}%`} emphasis />
          </dl>
          <p className="mt-3 text-xs leading-relaxed text-fg-muted">{kfs.aprComputation.method}</p>
        </Block>

        <section className="rounded-lg border border-line bg-surface p-5">
          <button
            type="button"
            onClick={() => setScheduleOpen(!scheduleOpen)}
            className="flex w-full items-center justify-between text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-muted hover:text-fg"
          >
            <span>Amortisation schedule ({kfs.amortisation.length} instalments)</span>
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${scheduleOpen ? "rotate-180" : ""}`} />
          </button>

          {scheduleOpen && (
            <div className="animate-fade-up mt-3 max-h-96 overflow-auto rounded-md border border-line">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-2">
                  <tr className="border-b border-line">
                    {["#", "Due", "Opening", "Payment", "Principal", "Interest", "Closing"].map((h) => (
                      <th key={h} className="px-2.5 py-2 text-left font-semibold uppercase tracking-[0.06em] text-fg-muted">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {kfs.amortisation.map((row) => (
                    <tr key={row.instalment} className="border-b border-line last:border-0">
                      <td className="tnum px-2.5 py-1.5">{row.instalment}</td>
                      <td className="tnum px-2.5 py-1.5 text-fg-muted">{row.dueDate}</td>
                      <td className="tnum px-2.5 py-1.5">{inr(row.openingBalance)}</td>
                      <td className="tnum px-2.5 py-1.5">{inr(row.payment)}</td>
                      <td className="tnum px-2.5 py-1.5">{inr(row.principalComponent)}</td>
                      <td className="tnum px-2.5 py-1.5">{inr(row.interestComponent)}</td>
                      <td className="tnum px-2.5 py-1.5">{inr(row.closingBalance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Action bar */}
        <section className="sticky bottom-4 rounded-lg border border-line-strong bg-surface p-5 shadow-lg">
          {error && <p className="mb-3 text-sm text-fg-muted">{error}</p>}

          {offer.status === "issued" && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="max-w-md text-xs leading-relaxed text-fg-muted">
                Accepting starts a {kfs.part2.coolingOffDays}-day cooling-off period. You can walk away
                during it for principal plus proportionate APR, with no penalty.
              </p>
              <button
                type="button"
                onClick={() => act("accept")}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-fg transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Accept these terms
              </button>
            </div>
          )}

          {offer.status === "accepted" && (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="solid">
                  <Check className="mr-1 h-3 w-3" /> Accepted
                </Badge>
                {withinCoolingOff && coolingOffEnds && (
                  <span className="text-xs text-fg-muted">
                    Cooling-off ends{" "}
                    {coolingOffEnds.toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                )}
              </div>

              {exit && <p className="text-sm leading-relaxed">{exit.explanation}</p>}

              {withinCoolingOff && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-3">
                  <p className="max-w-md text-xs leading-relaxed text-fg-muted">
                    One tap. No call centre, no retention script, no penalty.
                  </p>
                  <button
                    type="button"
                    onClick={() => act("cancel")}
                    disabled={busy}
                    className="inline-flex items-center gap-2 rounded-md border border-line-strong px-4 py-2.5 text-sm font-medium transition-colors hover:bg-surface-2 disabled:opacity-40"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Cancel this loan
                    {exit ? ` — pay ${inr(exit.totalPayable)}` : ""}
                  </button>
                </div>
              )}
            </div>
          )}

          {offer.status === "cancelled" && (
            <div>
              <Badge variant="outline">Cancelled under cooling-off</Badge>
              <p className="mt-2 text-sm leading-relaxed">
                Settled for {inr(offer.cancellationAmount ?? 0)} — principal plus proportionate APR. No
                penalty was charged and the upfront fees were refunded.
              </p>
            </div>
          )}
        </section>

        <p className="text-xs leading-relaxed text-fg-subtle">
          Modelled on RBI/2024-25/18 (Key Facts Statement for Loans &amp; Advances, 15 April 2024) and
          the Guidelines on Digital Lending (2 September 2022). This is a hackathon implementation of a
          real regulation, not a live credit product.
        </p>
      </main>
    </div>
  );
}
