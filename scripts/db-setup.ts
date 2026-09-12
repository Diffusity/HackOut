/**
 * Database migration and seed (ADR-032).
 *
 *   npm run db:migrate   # create tables
 *   npm run db:seed      # load the demo customers and transactions
 *   npm run db:check     # connectivity, row counts, chain integrity
 *   npm run db:reset     # clear the audit ledger and renumber from 1
 *
 * Seeding is idempotent: re-running it updates rather than duplicating, so it
 * is safe to run against a live demo database between rehearsals.
 */
import "dotenv/config";
import fs from "fs";
import path from "path";
import postgres from "postgres";
import customersSeed from "../src/data/customers.json";
import transactionsSeed from "../src/data/transactions.json";

const command = process.argv[2] ?? "check";

function connect(): postgres.Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error(
      "DATABASE_URL is not set.\n\n" +
        "Create a Supabase project (choose the Mumbai / ap-south-1 region for RBI\n" +
        "data localisation), then copy the *connection pooler* URI from\n" +
        "Project Settings > Database into .env as DATABASE_URL.\n\n" +
        "Everything still runs without it — the app falls back to the JSON seed."
    );
    process.exit(1);
  }
  if (url.includes("PASSWORD") || url.includes("[YOUR-PASSWORD]")) {
    console.error("DATABASE_URL still has the PASSWORD placeholder in it.");
    process.exit(1);
  }

  let host: string;
  try {
    host = new URL(url).hostname;
  } catch {
    console.error("DATABASE_URL is not a valid connection URI.");
    process.exit(1);
  }

  // The direct host is IPv6-only on Supabase and Vercel functions are IPv4, so
  // this fails in production even when it happens to work on a dev machine.
  if (/^db\..+\.supabase\.co$/.test(host)) {
    const ref = host.split(".")[1];
    console.error(
      [
        ``,
        `${host} is the DIRECT connection, which Supabase serves over IPv6 only.`,
        `Vercel functions are IPv4, so this cannot work in production.`,
        ``,
        `Use the pooler instead — Project Settings > Database > Connection pooling > Transaction:`,
        `  postgresql://postgres.${ref}:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres`,
        ``,
        `Note the username is postgres.${ref}, not plain "postgres".`,
        ``,
      ].join("\n")
    );
    process.exit(1);
  }

  return postgres(url, {
    max: 1,
    prepare: false,
    ssl: url.includes("localhost") ? false : "require",
    onnotice: () => {},
  });
}

async function migrate(sql: postgres.Sql) {
  const schema = fs.readFileSync(path.join(process.cwd(), "src", "lib", "db", "schema.sql"), "utf8");
  await sql.unsafe(schema);
  console.log("Schema applied.");
}

async function seed(sql: postgres.Sql) {
  const customers = customersSeed as {
    customerId: string;
    name: string;
    segment: string;
    cityTier: number;
    preferredLanguage: string;
    consent: { transactions: boolean; location: boolean; spendCategories: boolean };
  }[];

  const transactions = transactionsSeed as {
    txnId: string;
    customerId: string;
    timestamp: string;
    amount: number;
    type: string;
    category: string;
    merchant?: string;
    mode: string;
  }[];

  await sql`
    INSERT INTO customers ${sql(
      customers.map((c) => ({
        customer_id: c.customerId,
        name: c.name,
        segment: c.segment,
        city_tier: c.cityTier,
        preferred_language: c.preferredLanguage,
      })),
      "customer_id",
      "name",
      "segment",
      "city_tier",
      "preferred_language"
    )}
    ON CONFLICT (customer_id) DO UPDATE
      SET name = EXCLUDED.name,
          segment = EXCLUDED.segment,
          city_tier = EXCLUDED.city_tier,
          preferred_language = EXCLUDED.preferred_language
  `;
  console.log(`Customers: ${customers.length}`);

  // Chunked so a large ledger does not build one enormous statement.
  const CHUNK = 500;
  for (let i = 0; i < transactions.length; i += CHUNK) {
    const chunk = transactions.slice(i, i + CHUNK).map((t) => ({
      txn_id: t.txnId,
      customer_id: t.customerId,
      ts: new Date(t.timestamp),
      amount: t.amount,
      type: t.type,
      category: t.category,
      merchant: t.merchant ?? null,
      mode: t.mode,
    }));

    await sql`
      INSERT INTO transactions ${sql(
        chunk,
        "txn_id",
        "customer_id",
        "ts",
        "amount",
        "type",
        "category",
        "merchant",
        "mode"
      )}
      ON CONFLICT (txn_id) DO NOTHING
    `;
  }
  console.log(`Transactions: ${transactions.length}`);

  // Seed the consent ledger with the initial grant for each customer, so the
  // history has an origin rather than appearing to start mid-story.
  const existing = await sql<{ count: string }[]>`SELECT count(*) FROM consent_records`;
  if (Number(existing[0].count) === 0) {
    const purposes: Record<string, string> = {
      transactions: "Work out income, spending and savings patterns",
      location: "Match festival timing and local branch support",
      spendCategories: "Distinguish an EMI from an everyday debit",
    };

    const rows = customers.flatMap((c) =>
      (["transactions", "location", "spendCategories"] as const).map((scope) => ({
        customer_id: c.customerId,
        scope,
        granted: c.consent[scope],
        purpose: purposes[scope],
        actor: "onboarding",
      }))
    );

    await sql`
      INSERT INTO consent_records ${sql(rows, "customer_id", "scope", "granted", "purpose", "actor")}
    `;
    console.log(`Consent records: ${rows.length}`);
  } else {
    console.log(`Consent records: ${existing[0].count} already present, left untouched`);
  }
}

/**
 * Clears the ledger and restarts numbering at 1.
 *
 * The only supported way to remove audit records. Everything else in this
 * codebase treats them as append-only, and the hash chain is designed so that
 * deleting rows piecemeal is detectable. Wiping the whole chain and starting a
 * fresh one is honest; quietly removing rows from the middle of it is not.
 */
async function resetAudit(sql: postgres.Sql) {
  await sql`TRUNCATE audit_records RESTART IDENTITY`;
  await sql`DELETE FROM loan_offers`;
  console.log("Audit ledger cleared and renumbered from 1. Loan offers cleared.");
  console.log("Consent history and customer data were left alone.");
}

async function check(sql: postgres.Sql) {
  const [version] = await sql<{ version: string }[]>`SELECT version()`;
  console.log(version.version.split(",")[0]);

  for (const table of ["customers", "transactions", "consent_records", "audit_records", "loan_offers"]) {
    try {
      const [row] = await sql.unsafe<{ count: string }[]>(`SELECT count(*) FROM ${table}`);
      console.log(`  ${table.padEnd(18)} ${row.count}`);
    } catch {
      console.log(`  ${table.padEnd(18)} (missing — run db:migrate)`);
    }
  }

  // Verify the persisted hash chain end to end.
  try {
    const rows = await sql<{ seq: string; prev_hash: string; hash: string }[]>`
      SELECT seq, prev_hash, hash FROM audit_records ORDER BY seq ASC
    `;
    let previous = "0".repeat(64);
    let brokenAt: number | null = null;
    for (const row of rows) {
      if (row.prev_hash !== previous) {
        brokenAt = Number(row.seq);
        break;
      }
      previous = row.hash;
    }
    console.log(
      rows.length === 0
        ? "  audit chain        empty"
        : brokenAt === null
          ? `  audit chain        intact across ${rows.length} records`
          : `  audit chain        BROKEN at seq ${brokenAt}`
    );
  } catch {
    // audit_records not created yet
  }
}

async function main() {
  const sql = connect();
  try {
    if (command === "migrate") await migrate(sql);
    else if (command === "reset") await resetAudit(sql);
    else if (command === "seed") {
      await migrate(sql);
      await seed(sql);
    } else await check(sql);
  } finally {
    await sql.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
