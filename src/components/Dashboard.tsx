"use client";

import { useState, useEffect } from "react";
import { ProfileCard } from "./ProfileCard";
import { SignalsCard } from "./SignalsCard";
import { WellnessGauge } from "./WellnessGauge";
import { RecommendationCard } from "./RecommendationCard";
import { AuditLogPanel } from "./AuditLogPanel";
import { IncomeSpendChart } from "./IncomeSpendChart";
import { ChatWidget } from "./ChatWidget";
import { Customer, Signals, AuditEntry, Recommendation } from "@/lib/types";
import { Loader2 } from "lucide-react";

export function Dashboard() {
  const [customerId, setCustomerId] = useState("CUST_PRIYA");
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [signals, setSignals] = useState<Signals | null>(null);
  const [monthlyTxns, setMonthlyTxns] = useState<any[]>([]);
  const [recData, setRecData] = useState<{ recommendation: Recommendation, narration: string } | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [recLoading, setRecLoading] = useState(true);

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
  }, [customerId]);

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
              <SignalsCard signals={signals} />
              <WellnessGauge signals={signals} />
            </div>

            {/* Main Column: Chart & Recommendation (Span 6) */}
            <div className="lg:col-span-6 space-y-6">
              <RecommendationCard data={recData!} loading={recLoading} />
              <IncomeSpendChart data={monthlyTxns} />
            </div>

            {/* Right Column: Audit & Compliance (Span 3) */}
            <div className="lg:col-span-3 space-y-6">
              {recLoading ? (
                <div className="animate-pulse bg-gray-900 h-64 rounded-xl border border-white/5"></div>
              ) : (
                <AuditLogPanel logs={auditLogs} />
              )}
            </div>

          </div>
        )}
      </div>
      <ChatWidget customerId={customerId} />
    </div>
  );
}
