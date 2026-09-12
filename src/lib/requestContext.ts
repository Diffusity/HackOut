import { NextRequest } from "next/server";
import { CONSENT_COOKIE, applyConsentCookie } from "./consentStore";

export interface RequestContext {
  /** Time Machine clock (ADR-023): `?now=<ISO>`; undefined = real time. */
  now?: Date;
}

/**
 * Every API route calls this first. It rehydrates consent overrides from the
 * client cookie (serverless instances share no memory) and parses the demo
 * clock so a judge can move time and watch the deterministic engines react.
 */
export function initRequest(request: NextRequest): RequestContext {
  applyConsentCookie(request.cookies.get(CONSENT_COOKIE)?.value);

  const raw = request.nextUrl.searchParams.get("now");
  if (!raw) return {};
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? {} : { now: parsed };
}
