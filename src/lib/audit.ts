import { createHash } from "crypto";
import { AuditEntry, AuditRecord } from "./types";

/**
 * Tamper-evident audit log (ADR-025).
 *
 * A list of decisions a bank cannot prove is unaltered is worth little in a
 * regulatory review, so each record carries the SHA-256 of the previous one.
 * Changing or removing any past entry breaks every hash after it, and
 * `verifyChain()` reports exactly where the break is.
 *
 * Records are built here and flushed to Postgres after each request (ADR-032),
 * with each request continuing the chain from the persisted head. Without a
 * database configured the chain lives for the life of the process instead.
 */

const GENESIS = "0".repeat(64);

const auditLogs: AuditRecord[] = [];

/**
 * Where the chain continues from (ADR-032). Without a database this stays at
 * genesis and the chain lives for the life of the process. With one, each
 * request seeds these from the persisted head, so hashes chain continuously
 * across serverless instances and restarts rather than starting over — which
 * is what turns "we keep a log" into a record that survives the demo.
 */
// Starts at 1 to agree with Postgres BIGSERIAL. The sequence number is part of
// the hashed payload, so in-memory and persisted numbering must not diverge —
// otherwise a record hashed as #0 is stored as #1 and the two disagree about
// what was signed.
let chainBaseSeq = 1;
let chainBaseHash = GENESIS;
/** Index into auditLogs of the first record not yet written to the database. */
let flushedUpTo = 0;

export function seedAuditChain(head: { seq: number; hash: string } | null): void {
  if (!head) return;
  // Only move forward. A stale read must never rewind the chain we are building.
  if (head.seq + 1 > chainBaseSeq + auditLogs.length) {
    chainBaseSeq = head.seq + 1;
    chainBaseHash = head.hash;
    auditLogs.length = 0;
    flushedUpTo = 0;
  }
}

/** Returns records not yet persisted and marks them as handed off. */
export function flushAuditToDatabase(): AuditRecord[] {
  const pending = auditLogs.slice(flushedUpTo);
  flushedUpTo = auditLogs.length;
  return pending;
}

function canonicalize(entry: AuditEntry, seq: number, prevHash: string): string {
  // Stable key order — hashing must never depend on JS property ordering.
  return JSON.stringify([
    seq,
    prevHash,
    entry.timestamp.toISOString(),
    entry.customerId,
    entry.action,
    [...entry.dataAccessed],
    entry.consentVerified,
    entry.decision,
    [...entry.reasonTrace],
  ]);
}

export function hashEntry(entry: AuditEntry, seq: number, prevHash: string): string {
  return createHash("sha256").update(canonicalize(entry, seq, prevHash)).digest("hex");
}

export function logAuditEntry(entry: AuditEntry): AuditRecord {
  const seq = chainBaseSeq + auditLogs.length;
  const prevHash = auditLogs.length === 0 ? chainBaseHash : auditLogs[auditLogs.length - 1].hash;
  const record: AuditRecord = { ...entry, seq, prevHash, hash: hashEntry(entry, seq, prevHash) };
  auditLogs.push(record);
  console.log(`[AUDIT#${seq}] ${entry.customerId} - ${entry.action} - ${record.hash.slice(0, 12)}`);
  return record;
}

export function getAuditLogs(customerId: string): AuditRecord[] {
  return auditLogs.filter((log) => log.customerId === customerId).sort((a, b) => b.seq - a.seq);
}

export function getAllAuditLogs(): AuditRecord[] {
  return [...auditLogs].sort((a, b) => b.seq - a.seq);
}

export interface ChainVerification {
  valid: boolean;
  entries: number;
  /** Sequence number of the first record whose hash does not reconcile */
  brokenAt: number | null;
  headHash: string;
}

/** Recomputes every hash held in this process — the integrity proof shown in the UI. */
export function verifyChain(): ChainVerification {
  let prevHash = chainBaseHash;
  for (const record of auditLogs) {
    const expected = hashEntry(record, record.seq, prevHash);
    if (expected !== record.hash || record.prevHash !== prevHash) {
      return { valid: false, entries: auditLogs.length, brokenAt: record.seq, headHash: prevHash };
    }
    prevHash = record.hash;
  }
  return { valid: true, entries: auditLogs.length, brokenAt: null, headHash: prevHash };
}

/** Test-only: used by the eval suite to prove tampering is actually detected. */
export function __tamperForTest(seq: number, decision: string): void {
  const record = auditLogs.find((r) => r.seq === seq);
  if (record) record.decision = decision;
}

export function __resetAuditForTest(): void {
  auditLogs.length = 0;
  chainBaseSeq = 1;
  chainBaseHash = GENESIS;
  flushedUpTo = 0;
}
