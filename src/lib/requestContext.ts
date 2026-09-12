import { NextRequest } from "next/server";
import { CONSENT_COOKIE, applyConsentCookie } from "./consentStore";
import { loadSnapshot } from "./db/repository";
import { seedAuditChain, flushAuditToDatabase } from "./audit";
import { getAuditHead, persistAuditRecords } from "./db/repository";
import { DataSource } from "./db/client";

export interface RequestContext {
  /** Time Machine clock (ADR-023): `?now=<ISO>`; undefined = real time. */
  now?: Date;
  /** Where this request's data came from, surfaced in the UI. */
  source: DataSource;
}

/**
 * The single async boundary (ADR-032). Every API route awaits this first:
 *
 *  1. Loads the customer/transaction snapshot (Postgres, or the JSON seed).
 *  2. Seeds the in-process audit chain from the persisted head, so hashes chain
 *     continuously across serverless instances instead of restarting at genesis.
 *  3. Rehydrates consent overrides from the request's cookie.
 *  4. Parses the demo clock.
 *
 * After this returns, every decision function is synchronous and pure.
 */
export async function initRequest(request: NextRequest): Promise<RequestContext> {
  const snapshot = await loadSnapshot();

  const head = await getAuditHead();
  seedAuditChain(head);

  applyConsentCookie(request.cookies.get(CONSENT_COOKIE)?.value);

  const raw = request.nextUrl.searchParams.get("now");
  const parsed = raw ? new Date(raw) : null;

  return {
    now: parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined,
    source: snapshot.source,
  };
}

/**
 * Called at the end of a route that logged decisions. Persisting after the
 * response is computed keeps the audit write off the critical path for the
 * customer, and a failed write can never block a decision from being shown —
 * it is logged and retried on the next request instead.
 */
export async function finaliseRequest(): Promise<void> {
  const pending = flushAuditToDatabase();
  if (pending.length === 0) return;

  try {
    await persistAuditRecords(pending);
  } catch (e) {
    console.error("[audit] persistence failed; records remain in memory:", e);
  }
}
