import { AuditEntry } from "./types";

// In-memory audit log for the hackathon demo
const auditLogs: AuditEntry[] = [];

export function logAuditEntry(entry: AuditEntry): void {
  auditLogs.push(entry);
  console.log(`[AUDIT] [${entry.timestamp.toISOString()}] ${entry.customerId} - ${entry.action}`);
}

export function getAuditLogs(customerId: string): AuditEntry[] {
  return auditLogs.filter(log => log.customerId === customerId).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function getAllAuditLogs(): AuditEntry[] {
  return [...auditLogs].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}
