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
 * Demo scope: in-process storage. Production would append the same records to
 * WORM storage; the chaining logic is unchanged (see /compliance).
 */

const GENESIS = "0".repeat(64);

const auditLogs: AuditRecord[] = [];

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
  const seq = auditLogs.length;
  const prevHash = seq === 0 ? GENESIS : auditLogs[seq - 1].hash;
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

/** Recomputes every hash from genesis — the integrity proof shown in the UI. */
export function verifyChain(): ChainVerification {
  let prevHash = GENESIS;
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
}
