"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { ProfileCard } from "./ProfileCard";
import { SignalsCard } from "./SignalsCard";
import { WellnessGauge } from "./WellnessGauge";
import { RiskGauge } from "./RiskGauge";
import { RecommendationCard } from "./RecommendationCard";
import { AuditLogPanel, ChainStatus } from "./AuditLogPanel";
import { IncomeSpendChart } from "./IncomeSpendChart";
import { AnomalyCard } from "./AnomalyCard";
import { ChatWidget } from "./ChatWidget";
import { ConsentManager } from "./ConsentManager";
import { DecisionExplainer, Counterfactual } from "./DecisionExplainer";
import { ChannelPreview } from "./ChannelPreview";
import { ModelPanel } from "./ModelPanel";
import { TimeMachine } from "./TimeMachine";
import { DecisionReceipt } from "./DecisionReceipt";
import { ThemeToggle } from "./ThemeToggle";
import { Badge } from "./ui/badge";
import { SIPNudgeBanner } from "./SIPNudgeBanner";
import { CreditOfferModal } from "./CreditOfferModal";
import { WhatIfSimulator } from "./WhatIfSimulator";
import {
  AuditRecord,
  AuditEntry,
  Customer,
  ModelVerdict,
  Recommendation,
  Signals,
  StressAlert,
  TimingSignals,
} from "@/lib/types";
import { NextBestAction } from "@/lib/nextBestAction";
import { Loader2, ShieldOff, AlertCircle, X } from "lucide-react";

const PERSONAS = [
  { id: "CUST_PRIYA", label: "Priya", note: "Salaried saver" },
  { id: "CUST_RAMESH", label: "Ramesh", note: "Gig worker" },
  { id: "CUST_SUNITA", label: "Sunita", note: "Under stress" },
  { id: "CUST_SURESH", label: "Suresh", note: "Early warning" },
];

interface RecommendationPayload {
  recommendation: Recommendation;
  timing: TimingSignals | null;
  narrationSource: "llm" | "deterministic";
  counterfactuals: Counterfactual[];
  model: ModelVerdict | null;
  segment: { name: string; savingsPercentile: number; share: number } | null;
  nextBestAction: NextBestAction;
  anomalies: any;
  dataSource?: "database" | "seed";
  channels: { sms: string; ivr: string[] };
  auditLogs: AuditRecord[];
  chain: ChainStatus;
  asOf: string | null;
}

export function Dashboard() {
  const [customerId, setCustomerId] = useState("CUST_PRIYA");
  const [offsetDays, setOffsetDays] = useState(0);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [signals, setSignals] = useState<Signals | null>(null);
  const [monthlyTxns, setMonthlyTxns] = useState<any[]>([]);
  const [recData, setRecData] = useState<{ recommendation: Recommendation, narration: string } | null>(null);
  const [wellnessData, setWellnessData] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);
  const [consentState, setConsentState] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [payload, setPayload] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Fixed at mount so the slider does not drift while the demo is running.
  const baseDate = useMemo(() => new Date(), []);
  const asOf = useMemo(
    () => (offsetDays === 0 ? null : new Date(baseDate.getTime() + offsetDays * 86400000).toISOString()),
    [baseDate, offsetDays]
  );
  const query = asOf ? `?now=${encodeURIComponent(asOf)}` : "";

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      setLoading(true);
      setRecLoading(true);
      setPayload(null);

      try {
        const [profRes, sigRes, txnRes, wellRes, consRes, riskRes] = await Promise.all([
          fetch(`/api/customers/${customerId}${query}`),
          fetch(`/api/customers/${customerId}/signals${query}`),
          fetch(`/api/customers/${customerId}/transactions/monthly`),
          fetch(`/api/customers/${customerId}/wellness${query}`),
          fetch(`/api/customers/${customerId}/consent`),
          fetch(`/api/customers/${customerId}/risk`),
        ]);

        if (cancelled) return;
        if (profRes.ok) setCustomer(await profRes.json());
        if (sigRes.ok) {
          const sigJson = await sigRes.json();
          setSignals(sigJson.signals);
        }
        if (txnRes.ok) setMonthlyTxns(await txnRes.json());
        if (wellRes.ok) setWellnessData(await wellRes.json());
        if (riskRes.ok) setRiskData(await riskRes.json());
        if (consRes.ok) setConsentState(await consRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setLoading(false);
      }

      try {
        const recRes = await fetch(`/api/customers/${customerId}/recommendations${query}`);
        if (recRes.ok && !cancelled) setPayload(await recRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setRecLoading(false);
      }
    }

    fetchData();
    return () => {
      cancelled = true;
    };
  }, [customerId, refreshTrigger, query]);

  const hasConsent = consentState?.transactions !== false;
  const nba = payload?.nextBestAction;
  
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");

  useEffect(() => {
    if (payload?.anomalies?.overallRiskScore > 80) {
      setToastMessage(`High fraud risk detected (${payload.anomalies.overallRiskScore}/100)`);
      setShowToast(true);
      const timer = setTimeout(() => setShowToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [payload?.anomalies]);

  return (
    <div className="min-h-screen bg-bg">
      {/* Toast Notification */}
      {showToast && (
        <div className="fixed top-20 right-6 z-50 animate-fade-up rounded-lg border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger shadow-lg flex items-center gap-2 backdrop-blur-md">
          <AlertCircle className="h-4 w-4" />
          <span className="font-medium">{toastMessage}</span>
          <button onClick={() => setShowToast(false)} className="ml-4 hover:opacity-70">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 md:px-8">
          <div className="flex items-baseline gap-3">
            <span className="text-base font-semibold tracking-tight">DhanSathi</span>
            <span className="hidden text-xs text-fg-subtle sm:inline">
              Explainable banking for Bharat
            </span>
            {payload?.dataSource && (
              <Badge variant="muted" title={payload.dataSource === "database" ? "Reading from Postgres" : "Reading from the bundled JSON seed"}>
                {payload.dataSource === "database" ? "Postgres" : "Seed data"}
              </Badge>
            )}
          </div>

          <nav className="flex items-center gap-1 text-xs">
            <Link
              href="/model-card"
              className="rounded px-2 py-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Model card
            </Link>
            <Link
              href="/fairness"
              className="rounded px-2 py-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Fairness
            </Link>
            <Link
              href="/portfolio"
              className="rounded px-2 py-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Portfolio
            </Link>
            <Link
              href="/funding"
              className="rounded px-2 py-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Funding
            </Link>
            <Link
              href="/compliance"
              className="rounded px-2 py-1 text-fg-muted transition-colors hover:bg-surface-2 hover:text-fg"
            >
              Compliance
            </Link>
            <ThemeToggle />
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-8">
        <section className="flex flex-wrap items-center gap-2">
          <span className="mr-1 text-xs text-fg-subtle">Customer</span>
          {PERSONAS.map((persona) => (
            <button
              key={persona.id}
              type="button"
              onClick={() => setCustomerId(persona.id)}
              className={`rounded-md border px-3 py-1.5 text-left transition-colors ${
                customerId === persona.id
                  ? "border-transparent bg-accent text-accent-fg"
                  : "border-line text-fg-muted hover:bg-surface-2 hover:text-fg"
              }`}
            >
              <span className="block text-xs font-semibold">{persona.label}</span>
              <span
                className={`block text-[10px] ${customerId === persona.id ? "opacity-70" : "text-fg-subtle"}`}
              >
                {persona.note}
              </span>
            </button>
          ))}
        </section>

        <TimeMachine offsetDays={offsetDays} onChange={setOffsetDays} baseDate={baseDate} />

        {nba && (
          <section className="animate-fade-up rounded-lg border border-line bg-surface px-5 py-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="max-w-3xl">
                <div className="mb-1.5 flex items-center gap-2">
                  <Badge variant={nba.protective ? "solid" : "outline"}>
                    {nba.protective ? "Protective action" : "Next best action"}
                  </Badge>
                  <span className="text-[10px] uppercase tracking-[0.06em] text-fg-subtle">
                    source: {nba.source}
                  </span>
                </div>
                <h2 className="text-lg font-semibold tracking-tight">{nba.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-fg-muted">{nba.detail}</p>
              </div>
            </div>
          </section>
        )}

        {loading ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-fg-subtle" />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            <div className="space-y-5 lg:col-span-3">
              <ProfileCard customer={customer} segment={payload?.segment} />
              {hasConsent ? (
                <SignalsCard signals={signals} />
              ) : (
                <RestrictedNotice text="Signals are hidden because transaction access is switched off." />
              )}
              <WellnessGauge data={wellnessData} />
              <RiskGauge data={riskData} />
              <AnomalyCard data={payload?.anomalies ?? null} />
            </div>

            <div className="space-y-5 lg:col-span-6">
              {hasConsent ? (
                <>
                  <SIPNudgeBanner customer={customer} />
                  <RecommendationCard
                    recommendation={payload?.recommendation ?? null}
                    timing={payload?.timing}
                    narrationSource={payload?.narrationSource}
                    loading={recLoading}
                    customerId={customerId}
                    asOf={payload?.asOf}
                  />
                  {payload && (
                    <DecisionExplainer
                      customerId={customerId}
                      counterfactuals={payload.counterfactuals}
                      asOf={payload.asOf}
                    />
                  )}
                  <IncomeSpendChart data={monthlyTxns} />
                </>
              ) : (
                <RestrictedNotice text="We cannot make a recommendation without access to transaction history. Nothing is inferred, and nothing is guessed." />
              )}
            </div>

            <div className="space-y-5 lg:col-span-3">
              <WhatIfSimulator />
              <ConsentManager
                customerId={customerId}
                onConsentChange={() => setRefreshTrigger((n) => n + 1)}
              />
              {payload && <ModelPanel model={payload.model} />}
              {payload && (
                <ChannelPreview sms={payload.channels.sms} ivr={payload.channels.ivr} />
              )}
              {recLoading ? (
                <div className="h-48 animate-pulse rounded-lg border border-line bg-surface-2" />
              ) : (
                payload && (
                  <>
                    <AuditLogPanel logs={payload.auditLogs} chain={payload.chain} />
                    <DecisionReceipt
                      customerId={customerId}
                      customerName={customer?.name}
                      recommendation={payload.recommendation}
                      timing={payload.timing}
                      model={payload.model}
                      counterfactuals={payload.counterfactuals}
                      auditLogs={payload.auditLogs}
                      chain={payload.chain}
                      asOf={payload.asOf}
                    />
                  </>
                )
              )}
            </div>
          </div>
        )}
      </main>

      <CreditOfferModal customer={customer} />

      <ChatWidget
        customerId={customerId}
        customerName={customer?.name}
        recommendation={payload?.recommendation ?? null}
      />
    </div>
  );
}

function RestrictedNotice({ text }: { text: string }) {
  return (
    <div className="flex gap-3 rounded-lg border border-dashed border-line-strong bg-surface p-5">
      <ShieldOff className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle" />
      <p className="text-sm leading-relaxed text-fg-muted">{text}</p>
    </div>
  );
}
