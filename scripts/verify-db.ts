/**
 * Database integration verification (ADR-032). Requires DATABASE_URL.
 *
 *   npm run db:verify
 *
 * This exercises the claims that a reviewer would reasonably doubt:
 *  - the schema is valid Postgres and the seed round-trips
 *  - consent is an append-only ledger, not a mutable field
 *  - the audit chain CONTINUES across a simulated instance restart rather than
 *    restarting at genesis, which is the whole point of persisting it
 *  - tampering with a persisted row is detectable
 *  - a loan offer survives issue, accept and cooling-off cancel
 *
 * Safe to run repeatedly. It cleans up the rows it creates.
 */
// @ts-nocheck
import "dotenv/config";
import postgres from "postgres";
import { loadSnapshot, recordConsentChange, getConsentHistory, getAuditHead, persistAuditRecords, getPersistedAudit, verifyPersistedChain } from "../src/lib/db/repository";
import { logAuditEntry, verifyChain, seedAuditChain, flushAuditToDatabase, __resetAuditForTest } from "../src/lib/audit";
import { getCustomerSignals } from "../src/lib/tools/getCustomerSignals";
import { buildKeyFactsStatement, computeCoolingOffExit } from "../src/lib/lending/keyFactStatement";
import { saveOffer, getOffer, acceptOffer, cancelOffer } from "../src/lib/lending/loanStore";

let passed = 0;
let failed = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const TEST_CUSTOMER = "CUST_PRIYA";

async function main() {
  if (!process.env.DATABASE_URL) {
    console.log("DATABASE_URL is not set — skipping. The app runs on the JSON seed without it.");
    process.exit(0);
  }

  const admin = postgres(process.env.DATABASE_URL, {
    max: 1,
    prepare: false,
    ssl: process.env.DATABASE_URL.includes("localhost") ? false : "require",
    onnotice: () => {},
  });

  console.log("Snapshot");
  const snapshot = await loadSnapshot(true);
  check("Snapshot reports the database as its source", snapshot.source === "database", snapshot.source);
  check("Customers loaded", snapshot.customers.length > 0, `${snapshot.customers.length}`);
  check(
    "Transactions loaded and grouped by customer",
    (snapshot.transactionsByCustomer.get(TEST_CUSTOMER)?.length ?? 0) > 0,
    `${snapshot.transactionsByCustomer.get(TEST_CUSTOMER)?.length ?? 0} for ${TEST_CUSTOMER}`
  );
  check(
    "Transaction amounts survive the numeric round trip",
    snapshot.transactionsByCustomer.get(TEST_CUSTOMER)!.every((t) => typeof t.amount === "number" && !Number.isNaN(t.amount))
  );

  console.log("\nSignals compute identically off the database");
  const signals = getCustomerSignals(TEST_CUSTOMER).output;
  check("Signals derived from database rows", signals.monthlyIncome > 0, `income ₹${signals.monthlyIncome}`);

  console.log("\nConsent is an append-only ledger");
  const before = await getConsentHistory(TEST_CUSTOMER);
  await recordConsentChange(TEST_CUSTOMER, "spendCategories", false, "verify-db probe");
  await recordConsentChange(TEST_CUSTOMER, "spendCategories", true, "verify-db probe restore");
  const after = await getConsentHistory(TEST_CUSTOMER);
  check("Withdrawal and re-grant both recorded", after.length === before.length + 2, `${before.length} -> ${after.length}`);
  check("History is newest first", after[0].granted === true && after[1].granted === false);
  check("Purpose is stored with each change", after[0].purpose.length > 0);

  const refreshed = await loadSnapshot(true);
  check(
    "Current consent resolves to the latest row",
    refreshed.customers.find((c) => c.customerId === TEST_CUSTOMER)?.consent.spendCategories === true
  );

  console.log("\nThe audit chain continues across a restart");
  __resetAuditForTest();
  seedAuditChain(await getAuditHead());

  const marker = `verify-db-${Date.now()}`;
  for (let i = 0; i < 2; i++) {
    logAuditEntry({
      timestamp: new Date(),
      customerId: TEST_CUSTOMER,
      action: marker,
      dataAccessed: ["signals"],
      consentVerified: true,
      decision: `probe ${i}`,
      reasonTrace: [`probe trace ${i}`],
    });
  }
  const firstBatch = flushAuditToDatabase();
  await persistAuditRecords(firstBatch);
  check("First batch persisted", firstBatch.length === 2);

  // Simulate a cold start on a different serverless instance.
  const headAfterFirst = await getAuditHead();
  __resetAuditForTest();
  seedAuditChain(headAfterFirst);

  logAuditEntry({
    timestamp: new Date(),
    customerId: TEST_CUSTOMER,
    action: marker,
    dataAccessed: ["signals"],
    consentVerified: true,
    decision: "probe after restart",
    reasonTrace: ["continues the chain rather than restarting it"],
  });
  const secondBatch = flushAuditToDatabase();

  check(
    "A fresh instance chains from the persisted head, not from genesis",
    secondBatch[0].prevHash === headAfterFirst!.hash,
    `prevHash ${secondBatch[0].prevHash.slice(0, 12)} = persisted head ${headAfterFirst!.hash.slice(0, 12)}`
  );
  check("Sequence numbers continue rather than reset", secondBatch[0].seq === headAfterFirst!.seq + 1, `seq ${secondBatch[0].seq}`);
  check("In-memory verification still holds", verifyChain().valid);

  await persistAuditRecords(secondBatch);

  console.log("\nThe persisted chain verifies, and detects tampering");
  const chain = await verifyPersistedChain();
  check("Persisted chain is intact", chain.valid, `${chain.entries} records`);

  const persisted = await getPersistedAudit(TEST_CUSTOMER, 5);
  check("Records read back for the customer", persisted.length > 0, `${persisted.length}`);
  check("Read-back records carry their hashes", persisted.every((r) => r.hash.length === 64 && r.prevHash.length === 64));

  // Break a link, confirm detection, then repair it.
  const victim = secondBatch[0];
  const originalPrev = victim.prevHash;
  await admin`UPDATE audit_records SET prev_hash = ${"f".repeat(64)} WHERE hash = ${victim.hash}`;
  const broken = await verifyPersistedChain();
  check("Tampering with a persisted row breaks verification", !broken.valid, `broken at seq ${broken.brokenAt}`);
  await admin`UPDATE audit_records SET prev_hash = ${originalPrev} WHERE hash = ${victim.hash}`;
  const repaired = await verifyPersistedChain();
  check("Chain verifies again once restored", repaired.valid);

  // Idempotency: re-inserting the same records must not fork the chain.
  await persistAuditRecords(secondBatch);
  const afterDuplicate = await verifyPersistedChain();
  check("Re-persisting the same records is a no-op", afterDuplicate.entries === repaired.entries, `${afterDuplicate.entries}`);

  console.log("\nLoan offers round-trip");
  const kfs = buildKeyFactsStatement({ customerId: TEST_CUSTOMER, product: "PERSONAL_LOAN", signals });
  const offer = await saveOffer(kfs, "PERSONAL_LOAN");
  check("Offer stored", offer.proposalNo.length > 0, offer.proposalNo);

  const fetched = await getOffer(offer.proposalNo);
  check("Offer read back from the database", fetched !== null);
  check("APR survives the round trip", fetched?.apr === offer.apr, `${fetched?.apr}%`);
  check(
    "The KFS is stored in full, not as a template reference",
    (fetched?.kfs.amortisation.length ?? 0) === kfs.part1.tenorMonths,
    `${fetched?.kfs.amortisation.length} rows`
  );

  const acceptedAt = new Date();
  const coolingEnds = new Date(acceptedAt.getTime() + kfs.part2.coolingOffDays * 86400000);
  await acceptOffer(offer.proposalNo, acceptedAt, coolingEnds);
  const accepted = await getOffer(offer.proposalNo);
  check("Accept persists the cooling-off window", accepted?.status === "accepted" && accepted.coolingOffEndsAt !== null);

  const exit = computeCoolingOffExit(kfs, acceptedAt, new Date(acceptedAt.getTime() + 86400000));
  await cancelOffer(offer.proposalNo, new Date(), exit.totalPayable);
  const cancelled = await getOffer(offer.proposalNo);
  check("Cooling-off cancel persists with its settlement amount", cancelled?.status === "cancelled" && cancelled.cancellationAmount !== null, `₹${cancelled?.cancellationAmount}`);
  check("No penalty was recorded", exit.penalty === 0);

  console.log("\nCleanup");
  // Deliberately NOT deleting from audit_records.
  //
  // It is an append-only, hash-chained ledger; removing rows is precisely the
  // operation it exists to make detectable, and a verification script that
  // quietly does it is undermining the property it just finished asserting.
  // Earlier versions did delete, which left the live ledger starting at
  // sequence 5 and looking, reasonably, like records had gone missing.
  //
  // The probe rows stay. They are truthful records of a verification run, which
  // is exactly what an audit ledger is for. `npm run db:reset` clears the whole
  // ledger when a clean slate is genuinely wanted, such as before a demo.
  await admin`DELETE FROM loan_offers WHERE proposal_no = ${offer.proposalNo}`;
  await admin`DELETE FROM consent_records WHERE purpose LIKE 'verify-db probe%'`;
  console.log(`  probe loan offer and consent rows removed`);
  console.log(`  ${firstBatch.length + secondBatch.length} audit records kept — the ledger is append-only`);

  await admin.end();

  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
