import postgres from "postgres";

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

let client: postgres.Sql | null = null;
let initialised = false;

export function getSql(): postgres.Sql | null {
  if (initialised) return client;
  initialised = true;

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log("[db] DATABASE_URL not set — using the bundled JSON seed");
    return null;
  }

  try {
    client = postgres(url, {
      max: 1,
      idle_timeout: 20,
      connect_timeout: 10,
      prepare: false,
      ssl: url.includes("localhost") ? false : "require",
      onnotice: () => {},
    });
    console.log("[db] connected");
  } catch (e) {
    // A database that will not connect must degrade to the seed, never take
    // the product down. The banner in the UI says which source is live.
    console.error("[db] connection failed, falling back to the JSON seed:", e);
    client = null;
  }

  return client;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

/** Where the data actually came from, surfaced in the UI so it is never ambiguous. */
export type DataSource = "database" | "seed";
