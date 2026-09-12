import { Customer } from "./types";

/**
 * Consent overrides (ADR-022).
 *
 * On Vercel, module-level mutation does NOT survive between serverless
 * invocations: a judge toggling consent and reloading can hit a different
 * instance and see the toggle "revert". So the authoritative copy of any
 * consent CHANGE lives in a client cookie; this module holds the
 * request-scoped view of it that the deterministic tools read through
 * `getCustomerById`.
 */

export type ConsentState = Customer["consent"];

export const CONSENT_COOKIE = "dhansathi_consent";

const overrides = new Map<string, ConsentState>();

export function getConsentOverride(customerId: string): ConsentState | undefined {
  return overrides.get(customerId);
}

export function setConsentOverride(customerId: string, consent: ConsentState): void {
  overrides.set(customerId, consent);
}

export function serializeOverrides(): string {
  return encodeURIComponent(JSON.stringify(Object.fromEntries(overrides)));
}

/** Rehydrate the in-process view from the cookie at the start of a request. */
export function applyConsentCookie(raw: string | undefined): void {
  if (!raw) return;
  try {
    const parsed = JSON.parse(decodeURIComponent(raw)) as Record<string, ConsentState>;
    for (const [customerId, consent] of Object.entries(parsed)) {
      if (consent && typeof consent === "object") overrides.set(customerId, consent);
    }
  } catch {
    // A malformed cookie must never break the pipeline — fall back to seed consent.
  }
}
