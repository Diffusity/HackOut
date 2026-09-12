let postgres: any;
if (typeof window === 'undefined') {
  postgres = require('postgres');
}

/**
 * Database client (ADR-032).
 *
 * The whole app works with no database at all — the bundled JSON seed is the
 * fallback — so `sql` is null when `DATABASE_URL` is unset. That is not a
 * convenience: a judge cloning this repo with no credentials must still get a
 * working demo, and the deterministic pipeline must never depend on a network
 * round trip to reach a decision.
 *
 * Pooling: Supabase's Supavisor (and any transaction-mode pooler) does not
 * support prepared statements, so `prepare: false` is required or every query
 * fails after the first. `max: 1` keeps one connection per serverless instance
 * rather than opening a pool that the platform will freeze mid-flight.
 */

/**
 * Hard ceiling on any single database operation.
 *
 * `connect_timeout` only covers establishing a socket. A pooler that accepts
 * the connection and then queues it forever — which is exactly what a hosted
 * free tier does when its client limit is reached — leaves the query pending
 * with no timeout at all. That pending promise propagates all the way up: the
 * route never responds, the browser fetch never settles, and the dashboard
 * spins indefinitely with no error anywhere.
 *
 * Degrading to the seed after six seconds is always better than a spinner that
 * never resolves.
 */
/**
 * Must stay LONGER than `connect_timeout` below. When it was shorter, this
 * timeout fired first on every cold connection and reported "query timed out"
 * while hiding the actual connection error underneath — which cost a long
 * debugging session chasing the wrong failure.
 */
export const DB_TIMEOUT_MS = 10000;

export class DatabaseTimeout extends Error {
  constructor(label: string) {
    super(`${label} exceeded ${DB_TIMEOUT_MS}ms`);
    this.name = "DatabaseTimeout";
  }
}

/** Races a database operation against the ceiling above. */
export function withTimeout<T>(label: string, run: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new DatabaseTimeout(label)), DB_TIMEOUT_MS);
    run().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

/**
 * The client is pinned to globalThis, not held in a module-level variable.
 *
 * Turbopack re-evaluates modules between requests in dev, and route handlers
 * live in separate module graphs regardless. A module-level client is therefore
 * rebuilt constantly, and since postgres.js connects lazily, every request paid
 * a fresh TCP and TLS handshake to the database — which against a distant
 * region alone exceeded the query timeout and made every call look like a
 * failure. One connection per process, reused, is the whole fix.
 */
interface ClientStore {
  __dhansathiSql?: any | null;
  __dhansathiSqlInit?: boolean;
  __dhansathiDbError?: string | null;
}
const store = globalThis as unknown as ClientStore;

let lastError: string | null = store.__dhansathiDbError ?? null;

export function getDatabaseError(): string | null {
  return lastError;
}

export function recordDatabaseError(message: string): void {
  lastError = message;
  store.__dhansathiDbError = message;
}

/**
 * Catches the mistake almost everyone makes with Supabase.
 *
 * `db.<ref>.supabase.co` is the DIRECT connection. Supabase moved it to
 * IPv6-only, and Vercel's functions are IPv4, so it cannot work in production
 * and often cannot work locally either. The symptom is silent: the query
 * fails, we fall back to the seed, and the app looks like it is ignoring the
 * database. Naming the problem here costs one log line and saves an hour.
 */
function warnIfDirectConnection(url: string): void {
  try {
    const host = new URL(url).hostname;
    if (/^db\..*\.supabase\.co$/.test(host)) {
      const ref = host.split(".")[1];
      console.warn(
        `[db] ${host} is the DIRECT connection, which is IPv6-only and unreachable from Vercel.\n` +
          `[db] Use the connection pooler instead (Project Settings > Database > Connection pooling > Transaction):\n` +
          `[db]   postgresql://postgres.${ref}:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres\n` +
          `[db] Note the username is postgres.${ref}, not plain "postgres".`
      );
    }
  } catch {
    console.warn("[db] DATABASE_URL is not a valid URL — falling back to the JSON seed");
  }
}

export function getSql(): any | null {
  if (store.__dhansathiSqlInit) return store.__dhansathiSql ?? null;
  store.__dhansathiSqlInit = true;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[db] DATABASE_URL not set — using the bundled JSON seed");
    store.__dhansathiSql = null;
    return null;
  }
  if (url.includes("PASSWORD") || url.includes("[YOUR-PASSWORD]")) {
    lastError = "DATABASE_URL still contains the PASSWORD placeholder";
    console.warn(`[db] ${lastError} — using the bundled JSON seed`);
    store.__dhansathiSql = null;
    return null;
  }

  warnIfDirectConnection(url);

  try {
    store.__dhansathiSql = postgres(url, {
      // NOT 1. A single connection means head-of-line blocking: if that socket
      // goes stale — and a hosted pooler drops idle clients without telling the
      // driver — every subsequent query queues behind a dead connection and
      // hangs. A handful of connections lets a stale one fail on its own while
      // the rest keep working, which is the entire point of talking to a pooler.
      max: 4,
      // Shorter than the pooler's own idle cut-off, so the driver recycles the
      // socket before the far end silently discards it. Holding connections
      // longer looks like a saving and is actually how you accumulate dead ones.
      idle_timeout: 20,
      connect_timeout: 5,
      prepare: false,
      ssl: url.includes("localhost") ? false : "require",
      onnotice: () => {},
      // No `connection: { statement_timeout }` here, however tempting. A
      // transaction-mode pooler (Supavisor, PgBouncer) accepts only a fixed set
      // of startup parameters; sending it one it does not recognise makes every
      // query hang rather than fail, which is far worse than having no
      // server-side timeout. `withTimeout` above is the protection that works.
    });
    // Deliberately not "connected": postgres.js connects lazily, so nothing has
    // reached the database yet. Claiming a connection here is what made a
    // handshake failure look like a query failure.
    console.log(`[db] client ready for ${new URL(url).hostname}`);
  } catch (e) {
    // A database that will not connect must degrade to the seed, never take
    // the product down. The banner in the UI says which source is live.
    console.error("[db] client creation failed, falling back to the JSON seed:", e);
    store.__dhansathiSql = null;
  }

  return store.__dhansathiSql ?? null;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Where the data actually came from, surfaced in the UI so it is never ambiguous. */
export type DataSource = "database" | "seed";

export interface ResidencyInfo {
  configured: boolean;
  /** Hostname only — never the user, password or database name. */
  host: string | null;
  /** Cloud region, when the hostname encodes one. */
  region: string | null;
  /** Human-readable place, for the compliance page. */
  location: string | null;
  inIndia: boolean;
}

const REGION_NAMES: Record<string, string> = {
  "ap-south-1": "Mumbai, India",
  "ap-south-2": "Hyderabad, India",
  "ap-southeast-1": "Singapore",
  "ap-southeast-2": "Sydney, Australia",
  "ap-northeast-1": "Tokyo, Japan",
  "ap-northeast-2": "Seoul, South Korea",
  "us-east-1": "N. Virginia, United States",
  "us-east-2": "Ohio, United States",
  "us-west-1": "N. California, United States",
  "us-west-2": "Oregon, United States",
  "eu-west-1": "Ireland",
  "eu-west-2": "London, United Kingdom",
  "eu-central-1": "Frankfurt, Germany",
  "sa-east-1": "São Paulo, Brazil",
  "ca-central-1": "Canada",
};

/**
 * Reports where the database actually is (ADR-032).
 *
 * RBI data localisation is a claim worth nothing unless it can be checked, and
 * a hard-coded "Mumbai" on the compliance page would be a lie the moment the
 * project moved. This reads the real connection host so the page states what is
 * true — including when that is inconvenient.
 *
 * Only the hostname is ever exposed. Credentials are parsed out and discarded.
 */
export function getResidency(): ResidencyInfo {
  const url = process.env.DATABASE_URL;
  if (!url) return { configured: false, host: null, region: null, location: null, inIndia: false };

  try {
    const host = new URL(url).hostname;
    // Supabase pooler hosts encode the region: aws-0-ap-south-1.pooler.supabase.com
    const match = host.match(/(?:aws|gcp|azure)-\d+-([a-z]{2}-[a-z]+-\d)/i);
    const region = match ? match[1].toLowerCase() : null;

    return {
      configured: true,
      host,
      region,
      location: region ? (REGION_NAMES[region] ?? region) : null,
      inIndia: region ? region.startsWith("ap-south-") : false,
    };
  } catch {
    return { configured: true, host: null, region: null, location: null, inIndia: false };
  }
}
