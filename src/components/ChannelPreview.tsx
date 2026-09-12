"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

/**
 * Bharat Mode (ADR-024).
 *
 * The customers this product is for often bank on a feature phone over patchy
 * 2G. The same deterministic decision is rendered here as a 160-character SMS
 * and an IVR script, which demonstrates that the decision layer is independent
 * of the channel rather than welded to a React dashboard.
 */
export function ChannelPreview({ sms, ivr }: { sms: string; ivr: string[] }) {
  const [tab, setTab] = useState<"sms" | "ivr">("sms");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Same decision, any channel</CardTitle>
          <div className="flex gap-1">
            {(["sms", "ivr"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTab(option)}
                className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.06em] transition-colors ${
                  tab === option
                    ? "border-transparent bg-accent text-accent-fg"
                    : "border-line text-fg-muted hover:text-fg"
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {tab === "sms" ? (
          <div>
            <div className="rounded-md border border-line bg-surface-2 p-3 font-mono text-xs leading-relaxed">
              {sms}
            </div>
            <div className="mt-2 flex items-center justify-between text-[10px] text-fg-subtle">
              <span>Single GSM message</span>
              <span className="tnum">{sms.length}/160 characters</span>
            </div>
          </div>
        ) : (
          <div>
            <ol className="space-y-2">
              {ivr.map((line, i) => (
                <li key={i} className="flex gap-2.5 text-xs leading-relaxed">
                  <span className="tnum shrink-0 font-mono text-fg-subtle">{i + 1}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
            <p className="mt-3 text-[10px] text-fg-subtle">
              Played on a missed-call callback. No smartphone, no data connection.
            </p>
          </div>
        )}

        <div className="mt-3 border-t border-line pt-2">
          <Badge variant="muted">No LLM in this path</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
