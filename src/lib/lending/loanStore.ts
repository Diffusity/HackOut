import { getSql, recordDatabaseError } from "../db/client";
import { KeyFactsStatement } from "./keyFactStatement";

/**
 * Loan offer storage (ADR-033).
 *
 * The KFS is stored as issued, in full, rather than as a template reference.
 * If our rates or fees change tomorrow, the document this customer was shown
 * must still be reproducible exactly — that is the point of a Key Facts
 * Statement, and a foreign key to a mutable pricing table would destroy it.
 *
 * Falls back to process memory with no database, so the journey is
 * demonstrable on a fresh clone.
 */

export type OfferStatus = "issued" | "accepted" | "cancelled" | "expired";

export interface LoanOffer {
  proposalNo: string;
  customerId: string;
  product: string;
  principal: number;
  tenorMonths: number;
  nominalRate: number;
  apr: number;
  kfs: KeyFactsStatement;
  status: OfferStatus;
  issuedAt: string;
  kfsValidUntil: string;
  acceptedAt: string | null;
  coolingOffEndsAt: string | null;
  cancelledAt: string | null;
  cancellationAmount: number | null;
}

/**
 * Backed by globalThis, not a module-level const.
 *
 * Route handlers and server components are separate module graphs, so a plain
 * module-level Map gives each of them its own copy — an offer created by the
 * API is then invisible to the page that renders it. Hanging it off globalThis
 * keeps one map per process. It is still per-process, which is exactly why the
 * database path exists; this only has to hold up for a no-credentials demo.
 */
const globalStore = globalThis as unknown as { __dhansathiOffers?: Map<string, LoanOffer> };
const memory: Map<string, LoanOffer> = (globalStore.__dhansathiOffers ??= new Map());

/**
 * Every database call here is best-effort. The in-memory map is always written
 * first, so an unreachable database costs durability but never takes the loan
 * journey down mid-demo (ADR-032).
 */
async function tryDb<T>(label: string, fallback: T, run: () => Promise<T>): Promise<T> {
  if (!getSql()) return fallback;
  try {
    return await run();
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    recordDatabaseError(message);
    console.error(`[db] ${label} failed, using in-memory offers: ${message}`);
    return fallback;
  }
}

function fromKfs(kfs: KeyFactsStatement): LoanOffer {
  return {
    proposalNo: kfs.proposalNo,
    customerId: kfs.customerId,
    product: kfs.part1.loanType,
    principal: kfs.part1.sanctionedAmount,
    tenorMonths: kfs.part1.tenorMonths,
    nominalRate: kfs.part1.interestRate,
    apr: kfs.part1.apr,
    kfs,
    status: "issued",
    issuedAt: kfs.issuedAt,
    kfsValidUntil: kfs.validUntil,
    acceptedAt: null,
    coolingOffEndsAt: null,
    cancelledAt: null,
    cancellationAmount: null,
  };
}

export async function saveOffer(kfs: KeyFactsStatement, product: string): Promise<LoanOffer> {
  const offer = { ...fromKfs(kfs), product };
  memory.set(offer.proposalNo, offer);

  await tryDb("saveOffer", undefined, async () => {
    const sql = getSql()!;
    await sql`
      INSERT INTO loan_offers (
        proposal_no, customer_id, product, principal, tenor_months,
        nominal_rate, apr, kfs, status, issued_at, kfs_valid_until
      ) VALUES (
        ${offer.proposalNo}, ${offer.customerId}, ${product}, ${offer.principal},
        ${offer.tenorMonths}, ${offer.nominalRate}, ${offer.apr},
        ${sql.json(offer.kfs as never)}, 'issued', ${offer.issuedAt}, ${offer.kfsValidUntil}
      )
      ON CONFLICT (proposal_no) DO NOTHING
    `;
  });

  return offer;
}

export async function getOffer(proposalNo: string): Promise<LoanOffer | null> {
  const fromDb = await tryDb("getOffer", null as LoanOffer | null, async () => {
    const rows = await getSql()!<
      {
        proposal_no: string;
        customer_id: string;
        product: string;
        principal: string;
        tenor_months: number;
        nominal_rate: string;
        apr: string;
        kfs: KeyFactsStatement;
        status: OfferStatus;
        issued_at: Date;
        kfs_valid_until: Date;
        accepted_at: Date | null;
        cooling_off_ends_at: Date | null;
        cancelled_at: Date | null;
        cancellation_amount: string | null;
      }[]
    >`SELECT * FROM loan_offers WHERE proposal_no = ${proposalNo}`;

    if (rows.length > 0) {
      const r = rows[0];
      return {
        proposalNo: r.proposal_no,
        customerId: r.customer_id,
        product: r.product,
        principal: Number(r.principal),
        tenorMonths: r.tenor_months,
        nominalRate: Number(r.nominal_rate),
        apr: Number(r.apr),
        kfs: r.kfs,
        status: r.status,
        issuedAt: new Date(r.issued_at).toISOString(),
        kfsValidUntil: new Date(r.kfs_valid_until).toISOString(),
        acceptedAt: r.accepted_at ? new Date(r.accepted_at).toISOString() : null,
        coolingOffEndsAt: r.cooling_off_ends_at ? new Date(r.cooling_off_ends_at).toISOString() : null,
        cancelledAt: r.cancelled_at ? new Date(r.cancelled_at).toISOString() : null,
        cancellationAmount: r.cancellation_amount ? Number(r.cancellation_amount) : null,
      };
    }
    return null;
  });

  return fromDb ?? memory.get(proposalNo) ?? null;
}

export async function acceptOffer(
  proposalNo: string,
  acceptedAt: Date,
  coolingOffEndsAt: Date
): Promise<LoanOffer | null> {
  const existing = await getOffer(proposalNo);
  if (!existing) return null;

  const updated: LoanOffer = {
    ...existing,
    status: "accepted",
    acceptedAt: acceptedAt.toISOString(),
    coolingOffEndsAt: coolingOffEndsAt.toISOString(),
  };
  memory.set(proposalNo, updated);

  await tryDb("acceptOffer", undefined, async () => {
    await getSql()!`
      UPDATE loan_offers
         SET status = 'accepted',
             accepted_at = ${acceptedAt},
             cooling_off_ends_at = ${coolingOffEndsAt}
       WHERE proposal_no = ${proposalNo}
    `;
  });

  return updated;
}

export async function cancelOffer(
  proposalNo: string,
  cancelledAt: Date,
  amount: number
): Promise<LoanOffer | null> {
  const existing = await getOffer(proposalNo);
  if (!existing) return null;

  const updated: LoanOffer = {
    ...existing,
    status: "cancelled",
    cancelledAt: cancelledAt.toISOString(),
    cancellationAmount: amount,
  };
  memory.set(proposalNo, updated);

  await tryDb("cancelOffer", undefined, async () => {
    await getSql()!`
      UPDATE loan_offers
         SET status = 'cancelled',
             cancelled_at = ${cancelledAt},
             cancellation_amount = ${amount}
       WHERE proposal_no = ${proposalNo}
    `;
  });

  return updated;
}

export async function listOffersForCustomer(customerId: string): Promise<LoanOffer[]> {
  const fromDb = await tryDb("listOffersForCustomer", null as LoanOffer[] | null, async () => {
    const rows = await getSql()!<{ proposal_no: string }[]>`
      SELECT proposal_no FROM loan_offers
       WHERE customer_id = ${customerId}
       ORDER BY issued_at DESC LIMIT 10
    `;
    const offers = await Promise.all(rows.map((r) => getOffer(r.proposal_no)));
    return offers.filter((o): o is LoanOffer => o !== null);
  });
  if (fromDb) return fromDb;

  return [...memory.values()]
    .filter((o) => o.customerId === customerId)
    .sort((a, b) => b.issuedAt.localeCompare(a.issuedAt));
}
