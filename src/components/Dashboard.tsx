"use client";

import { useState, useEffect } from "react";
import { ProfileCard } from "./ProfileCard";
import { SignalsCard } from "./SignalsCard";
import { WellnessGauge } from "./WellnessGauge";
import { RiskGauge } from "./RiskGauge";
import { RecommendationCard } from "./RecommendationCard";
import { AuditLogPanel } from "./AuditLogPanel";
import { IncomeSpendChart } from "./IncomeSpendChart";
import { ChatWidget } from "./ChatWidget";
import { ConsentManager } from "./ConsentManager";
import { Customer, Signals, AuditEntry, Recommendation } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function Dashboard() {
  const [customerId, setCustomerId] = useState("CUST_PRIYA");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [signals, setSignals] = useState<Signals | null>(null);
  const [monthlyTxns, setMonthlyTxns] = useState<any[]>([]);
  const [recData, setRecData] = useState<{ recommendation: Recommendation, narration: string } | null>(null);
  const [wellnessData, setWellnessData] = useState<any>(null);
  const [riskData, setRiskData] = useState<any>(null);
  const [consentState, setConsentState] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setRecLoading(true);
      setRecData(null);
      setAuditLogs([]);

      try {
        // Fetch base profile
        const profRes = await fetch(`/api/customers/${customerId}`);
        if (profRes.ok) setCustomer(await profRes.json());

        // Fetch signals
        const sigRes = await fetch(`/api/customers/${customerId}/signals`);
        if (sigRes.ok) {
          const sigJson = await sigRes.json();
          setSignals(sigJson.signals);
        }

        // Fetch monthly txns
        const txnsRes = await fetch(`/api/customers/${customerId}/transactions/monthly`);
        if (txnsRes.ok) setMonthlyTxns(await txnsRes.json());

        // Fetch wellness
        const wellRes = await fetch(`/api/customers/${customerId}/wellness`);
        if (wellRes.ok) setWellnessData(await wellRes.json());

        // Fetch ML risk prediction (RiskNet, F26)
        const riskRes = await fetch(`/api/customers/${customerId}/risk`);
        if (riskRes.ok) setRiskData(await riskRes.json());
        
        // Fetch consent
        const consRes = await fetch(`/api/customers/${customerId}/consent`);
        if (consRes.ok) setConsentState(await consRes.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }

      // Fetch recommendations (takes longer because of LLM)
      try {
        const recRes = await fetch(`/api/customers/${customerId}/recommendations`);
        if (recRes.ok) {
          const data = await recRes.json();
          setRecData({
            recommendation: data.recommendation,
            narration: data.recommendation.plainLanguageExplanation
          });
          setAuditLogs(data.auditLogs || []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setRecLoading(false);
      }
    }

    fetchData();
  }, [customerId, refreshTrigger]);

  const hasTransactionConsent = consentState?.transactions;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100 font-sans p-4 md:p-8 selection:bg-indigo-500/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header & Customer Picker */}
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-white/10">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              DhanSathi Customer 360
            </h1>
            <p className="text-sm text-gray-500">Agentic Banking Demo</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Select Persona:</label>
            <select 
              className="bg-gray-900 border border-white/10 rounded-md px-3 py-1.5 text-sm focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
            >
              <option value="CUST_PRIYA">Priya (Salaried, Saver)</option>
              <option value="CUST_RAMESH">Ramesh (Gig Worker)</option>
              <option value="CUST_SUNITA">Sunita (Financially Stressed)</option>
            </select>
          </div>
        </header>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Left Column: Profile & Signals (Span 3) */}
            <div className="lg:col-span-3 space-y-6">
              <ProfileCard customer={customer} />
              <div className="relative">
                {!hasTransactionConsent && (
                  <div className="absolute inset-0 z-10 backdrop-blur-sm bg-black/40 rounded-xl flex items-center justify-center p-4 text-center">
                    <span className="text-sm font-medium text-gray-300 bg-gray-900/80 px-3 py-2 rounded-lg border border-white/10">
                      🔒 Signals restricted by privacy settings
                    </span>
                  </div>
                )}
                <SignalsCard signals={signals} />
              </div>
              <WellnessGauge data={wellnessData} />
              <RiskGauge data={riskData} />
            </div>

            {/* Main Column: Chart & Recommendation (Span 6) */}
            <div className="lg:col-span-6 space-y-6">
              {!hasTransactionConsent ? (
                 <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-6 text-rose-200">
                   <span className="font-semibold block mb-2 text-lg">🔒 Consent Required</span>
                   We cannot generate Agentic recommendations without access to your transaction history. Please enable access in the Privacy Controls.
                 </div>
              ) : (
                <RecommendationCard data={recData!} loading={recLoading} />
              )}
              
              <div className="relative">
                {!hasTransactionConsent && (
                  <div className="absolute inset-0 z-10 backdrop-blur-[6px] bg-black/20 rounded-xl flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-300 bg-gray-900/80 px-4 py-2 rounded-lg border border-white/10">
                      🔒 Chart hidden to protect privacy
                    </span>
                  </div>
                )}
                <IncomeSpendChart data={monthlyTxns} />
              </div>
            </div>

            {/* Right Column: Audit & Compliance (Span 3) */}
            <div className="lg:col-span-3 space-y-6">
              <ConsentManager customerId={customerId} onConsentChange={() => setRefreshTrigger(prev => prev + 1)} />
              {recLoading ? (
                <div className="animate-pulse bg-gray-900 h-64 rounded-xl border border-white/5"></div>
              ) : (
                <AuditLogPanel logs={auditLogs} />
              )}
            </div>

          </div>
        )}
      </div>
      <ChatWidget customerId={customerId} recommendation={recData?.recommendation ?? null} />
    </div>
  );
}
