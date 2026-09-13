// @ts-nocheck
"use client";

import { useState } from "react";
import { AuditRecord } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";
import { Check, ChevronDown, Link2, TriangleAlert } from "lucide-react";

export interface ChainStatus {
  valid: boolean;
  entries: number;
  brokenAt: number | null;
  headHash: string;
}

/**
 * The audit ledger, shown as what it is: a hash chain. Each record carries the
 * SHA-256 of the one before it, so the panel can state — not merely claim —
 * that nothing in the history has been altered.
 */
export function AuditLogPanel({ logs, chain }: { logs: AuditRecord[]; chain?: ChainStatus | null }) {
  const [expanded, setExpanded] = useState<number | null>(null);

  if (!logs || logs.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>Audit ledger</CardTitle>
          {chain && (
            <Badge variant={chain.valid ? "solid" : "outline"} className="gap-1">
              {chain.valid ? <Check className="h-3 w-3" /> : <TriangleAlert className="h-3 w-3" />}
              {chain.valid ? "Chain verified" : `Broken at #${chain.brokenAt}`}
            </Badge>
          )}
        </div>
        {chain && (
          <p className="text-xs leading-relaxed text-fg-muted">
            {/*
              These two numbers count different things and used to look like a
              contradiction: the chain spans every customer, the list below is
              only this one. Saying so is cheaper than explaining it out loud to
              someone reading the panel.
            */}
            <span className="tnum">{chain.entries}</span> records in the chain, across all
            customers. Showing the <span className="tnum">{logs.length}</span> for this customer,
            newest first. Head{" "}
            <span className="tnum font-mono">{chain.headHash.slice(0, 16)}…</span>
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-2">
        {logs.map((log) => {
          const open = expanded === log.seq;
          return (
            <div key={log.seq} className="rounded-md border border-line bg-surface-2">
              <button
                type="button"
                onClick={() => setExpanded(open ? null : log.seq)}
                className="flex w-full items-start justify-between gap-3 p-3 text-left"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {/*
                      A ledger position assigned by the database, not an index
                      into this list. It does not start at 1 and it is not
                      "N of N" — the title says so for anyone who wonders.
                    */}
                    <span
                      className="tnum font-mono text-[10px] text-fg-subtle"
                      title={`Ledger position ${log.seq}, assigned by the database across all customers`}
                    >
                      #{log.seq}
                    </span>
                    <span className="truncate text-xs font-medium">{log.action}</span>
                  </div>
                  <div className="mt-1 truncate text-xs text-fg-muted">{log.decision}</div>
                </div>
                <ChevronDown
                  className={`mt-0.5 h-3.5 w-3.5 shrink-0 text-fg-subtle transition-transform ${open ? "rotate-180" : ""}`}
                />
              </button>

              {open && (
                <div className="animate-fade-up space-y-2 border-t border-line p-3 text-xs">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant={log.consentVerified ? "outline" : "solid"}>
                      {log.consentVerified ? "Consent verified" : "No consent"}
                    </Badge>
                    {log.dataAccessed.map((d: any) => (
                      <Badge key={d} variant="muted">
                        {d}
                      </Badge>
                    ))}
                  </div>

                  <div className="text-fg-muted">
                    {new Date(log.timestamp).toLocaleString()}
                  </div>

                  {log.reasonTrace.length > 0 && (
                    <ul className="space-y-1 text-fg-muted">
                      {log.reasonTrace.map((t: any, i: any) => (
                        <li key={i} className="flex gap-2">
                          <span className="text-fg-subtle">—</span>
                          <span className="break-words">{t}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  <div className="space-y-1 border-t border-line pt-2 font-mono text-[10px] text-fg-subtle">
                    <div className="flex items-start gap-1.5">
                      <Link2 className="mt-0.5 h-3 w-3 shrink-0" />
                      <span className="break-all">prev {log.prevHash.slice(0, 32)}…</span>
                    </div>
                    <div className="break-all pl-[18px]">self {log.hash.slice(0, 32)}…</div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
