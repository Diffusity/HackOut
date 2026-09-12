import { getSql, DataSource } from "./client";
import { Customer, Transaction, AuditRecord } from "../types";
import customersSeed from "@/data/customers.json";
import transactionsSeed from "@/data/transactions.json";

/**
 * Repository (ADR-032).
 *
 * There is exactly ONE async boundary in this application: loading a snapshot
 * of customer data. Everything downstream — signals, the recommender, the
 * distress model, the wellness gate, the counterfactual search — stays
 * synchronous and pure over that in-memory snapshot.
 *
 * This is not stylistic. The counterfactual engine sweeps the decision function
 * hundreds of times to find the value that flips an outcome; if each of those
 * evaluations touched a database the feature would be impossible. Loading once
 * and deciding in memory is what lets a bank-grade explanation stay cheap.
 */

export interface Snapshot {
  customers: Customer[];
  transactionsByCustomer: Map<string, Transaction[]>;
  source: DataSource;
  loadedAt: number;
}

const SNAPSHOT_TTL_MS = 30_000;

let cached: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

function buildSeedSnapshot(): Snapshot {
  const customers = customersSeed as Customer[];
  const transactions = transactionsSeed as Transaction[];
  const transactionsByCustomer = new Map<string, Transaction[]>();

  for (const t of transactions) {
    const list = transactionsByCustomer.get(t.customerId);
    if (list) list.push(t);
    else transactionsByCustomer.set(t.customerId, [t]);
  }

  return { customers, transactionsByCustomer, source: "seed", loadedAt: Date.now() };
}

interface CustomerRow {
  customer_id: string;
  name: string;
  segment: Customer["segment"];
  city_tier: number;
  preferred_language: string;
}

interface TransactionRow {
  txn_id: string;
  customer_id: string;
  ts: Date;
  amount: string;
  type: Transaction["type"];
  category: Transaction["category"];
  merchant: string | null;
  mode: Transaction["mode"];
}

interface ConsentRow {
  customer_id: string;
  scope: keyof Customer["consent"];
  granted: boolean;
}

async function buildDatabaseSnapshot(): Promise<Snapshot> {
  const sql = getSql();
  if (!sql) return buildSeedSnapshot();

  const [customerRows, transactionRows, consentRows] = await Promise.all([
    sql<CustomerRow[]>`
      SELECT customer_id, name, segment, city_tier, preferred_language
      FROM customers
      ORDER BY created_at
    `,
    sql<TransactionRow[]>`
      SELECT txn_id, customer_id, ts, amount, type, category, merchant, mode
      FROM transactions
      ORDER BY customer_id, ts
    `,
    // Current consent is the most recent row per (customer, scope). DISTINCT ON
    // is the cheap Postgres way to say that without a window function.
    sql<ConsentRow[]>`
      SELECT DISTINCT ON (customer_id, scope) customer_id, scope, granted
      FROM consent_records
      ORDER BY customer_id, scope, changed_at DESC
    `,
  ]);

  if (customerRows.length === 0) {
    console.log("[db] connected but empty — run `npm run db:seed`; using the JSON seed meanwhile");
    return buildSeedSnapshot();
  }

  const consentByCustomer = new Map<string, Customer["consent"]>();
  for (const row of consentRows) {
    const existing =
      consentByCustomer.get(row.customer_id) ??
      { transactions: true, location: true, spendCategories: true };
    existing[row.scope] = row.granted;
    consentByCustomer.set(row.customer_id, existing);
  }

  const customers: Customer[] = customerRows.map((row) => ({
    customerId: row.customer_id,
    name: row.name,
    segment: row.segment,
    cityTier: row.city_tier as Customer["cityTier"],
    preferredLanguage: row.preferred_language as Customer["preferredLanguage"],
    consent:
      consentByCustomer.get(row.customer_id) ??
      { transactions: true, location: true, spendCategories: true },
  }));

  const transactionsByCustomer = new Map<string, Transaction[]>();
  for (const row of transactionRows) {
    const txn: Transaction = {
      txnId: row.txn_id,
      customerId: row.customer_id,
      timestamp: new Date(row.ts).toISOString(),
      amount: Number(row.amount),
      type: row.type,
      category: row.category,
      merchant: row.merchant ?? undefined,
      mode: row.mode,
    };
    const list = transactionsByCustomer.get(row.customer_id);
    if (list) list.push(txn);
    else transactionsByCustomer.set(row.customer_id, [txn]);
  }

  return { customers, transactionsByCustomer, source: "database", loadedAt: Date.now() };
}

/**
 * Returns the current snapshot, refreshing from the database at most once every
 * 30 seconds. Customer and transaction data is read-mostly, so re-querying it
 * on every request would spend the free tier's connection budget for nothing.
 */
export async function loadSnapshot(force = false): Promise<Snapshot> {
  const fresh = cached && Date.now() - cached.loadedAt < SNAPSHOT_TTL_MS;
  if (fresh && !force) return cached!;
  if (inflight && !force) return inflight;

  inflight = (async () => {
    try {
      const snapshot = await buildDatabaseSnapshot();
      cached = snapshot;
      return snapshot;
    } catch (e) {
      console.error("[db] snapshot load failed, using the JSON seed:", e);
      cached = buildSeedSnapshot();
      return cached;
    } finally {
      inflight = null;
    }
  })();

  return inflight;
}

/** Synchronous access for code that has already awaited `loadSnapshot`. */
export function currentSnapshot(): Snapshot {
  if (!cached) cached = buildSeedSnapshot();
  return cached;
}

// ---------------------------------------------------------------- consent

export async function recordConsentChange(
  customerId: string,
  scope: keyof Customer["consent"],
  granted: boolean,
  purpose: string
): Promise<void> {
  const sql = getSql();
  if (!sql) return;

  await sql`
    INSERT INTO consent_records (customer_id, scope, granted, purpose)
    VALUES (${customerId}, ${scope}, ${granted}, ${purpose})
  `;
  // The snapshot's consent view is now stale.
  if (cached) cached.loadedAt = 0;
}

export interface ConsentHistoryEntry {
  scope: string;
  granted: boolean;
  purpose: string;
  changedAt: string;
}

export async function getConsentHistory(customerId: string): Promise<ConsentHistoryEntry[]> {
  const sql = getSql();
  if (!sql) return [];

  const rows = await sql<
    { scope: string; granted: boolean; purpose: string; changed_at: Date }[]
  >`
    SELECT scope, granted, purpose, changed_at
    FROM consent_records
    WHERE customer_id = ${customerId}
    ORDER BY changed_at DESC
    LIMIT 50
  `;

  return rows.map((r) => ({
    scope: r.scope,
    granted: r.granted,
    purpose: r.purpose,
    changedAt: new Date(r.changed_at).toISOString(),
  }));
}

// ---------------------------------------------------------------- audit

/** The hash the in-process chain must continue from, so it survives restarts. */
export async function getAuditHead(): Promise<{ seq: number; hash: string } | null> {
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql<{ seq: string; hash: string }[]>`
    SELECT seq, hash FROM audit_records ORDER BY seq DESC LIMIT 1
  `;
  if (rows.length === 0) return null;
  return { seq: Number(rows[0].seq), hash: rows[0].hash };
}

export async function persistAuditRecords(records: AuditRecord[]): Promise<number> {
  const sql = getSql();
  if (!sql || records.length === 0) return 0;

  const rows = records.map((r) => ({
    customer_id: r.customerId,
    action: r.action,
    data_accessed: r.dataAccessed,
    consent_verified: r.consentVerified,
    decision: r.decision,
    reason_trace: r.reasonTrace,
    prev_hash: r.prevHash,
    hash: r.hash,
    occurred_at: r.timestamp,
  }));

  // ON CONFLICT on the hash makes the write idempotent: a retried request
  // cannot fork the chain by inserting the same record twice.
  await sql`
    INSERT INTO audit_records ${sql(
      rows,
      "customer_id",
      "action",
      "data_accessed",
      "consent_verified",
      "decision",
      "reason_trace",
      "prev_hash",
      "hash",
      "occurred_at"
    )}
    ON CONFLICT (hash) DO NOTHING
  `;

  return rows.length;
}

export async function getPersistedAudit(customerId: string, limit = 25): Promise<AuditRecord[]> {
  const sql = getSql();
  if (!sql) return [];

  const rows = await sql<
    {
      seq: string;
      customer_id: string;
      action: string;
      data_accessed: string[];
      consent_verified: boolean;
      decision: string;
      reason_trace: string[];
      prev_hash: string;
      hash: string;
      occurred_at: Date;
    }[]
  >`
    SELECT seq, customer_id, action, data_accessed, consent_verified,
           decision, reason_trace, prev_hash, hash, occurred_at
    FROM audit_records
    WHERE customer_id = ${customerId}
    ORDER BY seq DESC
    LIMIT ${limit}
  `;

  return rows.map((r) => ({
    seq: Number(r.seq),
    customerId: r.customer_id,
    action: r.action,
    dataAccessed: r.data_accessed,
    consentVerified: r.consent_verified,
    decision: r.decision,
    reasonTrace: r.reason_trace,
    prevHash: r.prev_hash,
    hash: r.hash,
    timestamp: new Date(r.occurred_at),
  }));
}

/**
 * Verifies the persisted chain end to end, in the database rather than in
 * memory. This is the version that means something: it proves no row was
 * edited after the fact, including by us.
 */
export async function verifyPersistedChain(): Promise<{
  valid: boolean;
  entries: number;
  brokenAt: number | null;
  headHash: string | null;
}> {
  const sql = getSql();
  if (!sql) return { valid: true, entries: 0, brokenAt: null, headHash: null };

  const rows = await sql<{ seq: string; prev_hash: string; hash: string }[]>`
    SELECT seq, prev_hash, hash FROM audit_records ORDER BY seq ASC
  `;

  let previous = "0".repeat(64);
  for (const row of rows) {
    if (row.prev_hash !== previous) {
      return { valid: false, entries: rows.length, brokenAt: Number(row.seq), headHash: previous };
    }
    previous = row.hash;
  }

  return {
    valid: true,
    entries: rows.length,
    brokenAt: null,
    headHash: rows.length > 0 ? previous : null,
  };
}
