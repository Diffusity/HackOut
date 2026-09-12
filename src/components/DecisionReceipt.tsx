"use client";

import { useState } from "react";
import { Download, Check } from "lucide-react";
import { AuditRecord, ModelVerdict, Recommendation, TimingSignals } from "@/lib/types";
import { Counterfactual } from "./DecisionExplainer";
import { ChainStatus } from "./AuditLogPanel";

/**
 * The decision receipt.
 *
 * Under the DPDP Act a person may ask for the data held about them; under any
 * sensible reading of lending fairness they should also be able to walk out
 * with the decision itself — every fact used, every reason, what would have
 * changed it, and the hash that proves the record has not been edited since.
 *
 * If a customer wants to challenge this decision with an ombudsman, this file
 * is the whole case, and they do not have to ask us for it.
 */
export function DecisionReceipt({
  customerId,
  customerName,
  recommendation,
  timing,
  model,
  counterfactuals,
  auditLogs,
  chain,
  asOf,
}: {
  customerId: string;
  customerName?: string;
  recommendation: Recommendation;
  timing?: TimingSignals | null;
  model?: ModelVerdict | null;
  counterfactuals: Counterfactual[];
  auditLogs: AuditRecord[];
  chain: ChainStatus;
  asOf?: string | null;
}) {
  const [saved, setSaved] = useState(false);

  const download = () => {
    const receipt = {
      receiptVersion: "1.0",
      issuedAt: new Date().toISOString(),
      decisionAsOf: asOf ?? new Date().toISOString(),
      customer: { id: customerId, name: customerName ?? null },
      decision: {
        product: recommendation.product,
        confidence: recommendation.confidence,
        wellnessGateStatus: recommendation.wellnessGateStatus,
        explanation: recommendation.plainLanguageExplanation,
      },
      reasonTrace: recommendation.reasonTrace,
      timing: timing ?? null,
      model: model
        ? {
            version: model.modelVersion,
            probability: model.probability,
            threshold: model.threshold,
            escalatedByModel: model.escalatedByModel,
            contributions: model.contributions,
          }
        : null,
      whatWouldChangeThis: counterfactuals.map((c) => ({
        factor: c.label,
        currentValue: c.currentValue,
        requiredValue: c.requiredValue,
        wouldResultIn: c.resultingProductName,
      })),
      auditChain: {
        verified: chain.valid,
        records: auditLogs.map((log) => ({
          seq: log.seq,
          timestamp: log.timestamp,
          action: log.action,
          decision: log.decision,
          dataAccessed: log.dataAccessed,
          consentVerified: log.consentVerified,
          prevHash: log.prevHash,
          hash: log.hash,
        })),
        headHash: chain.headHash,
      },
      yourRights: [
        "You may contest this decision. Every factor used is listed above.",
        "The 'what would change this' section is computed from the same engine that made the decision, so it is exact rather than indicative.",
        "Each record carries the hash of the record before it. Altering any entry invalidates every hash that follows.",
      ],
    };

    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `dhansathi-decision-${customerId.toLowerCase()}-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <button
      type="button"
      onClick={download}
      className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-surface px-3 py-2.5 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
    >
      {saved ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
      {saved ? "Receipt downloaded" : "Download my decision receipt"}
    </button>
  );
}
