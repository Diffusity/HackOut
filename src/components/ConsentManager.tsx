import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ShieldAlert, Database, MapPin, Receipt, Loader2, Check } from "lucide-react";

export function ConsentManager({ customerId, onConsentChange }: { customerId: string, onConsentChange: () => void }) {
  const [consent, setConsent] = useState({
    transactions: true,
    location: true,
    spendCategories: true
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  // Master toggle controls everything
  const allEnabled = consent.transactions && consent.location && consent.spendCategories;

  useEffect(() => {
    async function fetchConsent() {
      setLoading(true);
      try {
        const res = await fetch(`/api/customers/${customerId}/consent`);
        if (res.ok) {
          const data = await res.json();
          setConsent(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchConsent();
  }, [customerId]);

  const updateConsent = async (newConsent: typeof consent) => {
    setConsent(newConsent);
    setSaving(true);
    try {
      await fetch(`/api/customers/${customerId}/consent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consent: newConsent })
      });
      // Trigger dashboard reload
      onConsentChange();
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAll = () => {
    const newVal = !allEnabled;
    updateConsent({
      transactions: newVal,
      location: newVal,
      spendCategories: newVal
    });
  };

  if (loading) {
    return (
      <Card className="border-indigo-900/50 bg-indigo-950/10">
        <CardContent className="p-6 flex justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-900/50 bg-gray-950 shadow-[0_0_15px_rgba(99,102,241,0.05)]">
      <CardHeader className="pb-3 border-b border-white/5 bg-gray-900/40">
        <div className="flex justify-between items-center">
          <CardTitle className="text-sm flex items-center gap-2 text-indigo-300">
            <ShieldAlert className="w-4 h-4" />
            Privacy Controls (DPDP Act)
          </CardTitle>
          {saving && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
        </div>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        
        {/* Master Toggle */}
        <div className="flex items-center justify-between p-3 bg-gray-900/80 rounded-lg border border-white/5">
          <div>
            <div className="font-semibold text-sm text-gray-200">Allow AI Data Analysis</div>
            <div className="text-xs text-gray-500">Enable Agentic features & personalized recommendations.</div>
          </div>
          <button 
            onClick={handleToggleAll}
            className={`w-12 h-6 rounded-full transition-colors relative ${allEnabled ? 'bg-indigo-500' : 'bg-gray-700'}`}
          >
            <div className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-all ${allEnabled ? 'left-7' : 'left-1'}`}></div>
          </button>
        </div>

        {/* Sub Toggles */}
        <div className="space-y-3 pl-2 border-l-2 border-gray-800 ml-2">
          
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Database className="w-4 h-4 text-gray-500" />
              <span>Transaction History</span>
            </div>
            <button 
              onClick={() => updateConsent({ ...consent, transactions: !consent.transactions })}
              className={`w-8 h-4 rounded-full transition-colors relative ${consent.transactions ? 'bg-emerald-500/80' : 'bg-gray-800'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${consent.transactions ? 'left-4' : 'left-0.5'}`}></div>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Receipt className="w-4 h-4 text-gray-500" />
              <span>Spend Categories</span>
            </div>
            <button 
              onClick={() => updateConsent({ ...consent, spendCategories: !consent.spendCategories })}
              className={`w-8 h-4 rounded-full transition-colors relative ${consent.spendCategories ? 'bg-emerald-500/80' : 'bg-gray-800'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${consent.spendCategories ? 'left-4' : 'left-0.5'}`}></div>
            </button>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <MapPin className="w-4 h-4 text-gray-500" />
              <span>Location Data</span>
            </div>
            <button 
              onClick={() => updateConsent({ ...consent, location: !consent.location })}
              className={`w-8 h-4 rounded-full transition-colors relative ${consent.location ? 'bg-emerald-500/80' : 'bg-gray-800'}`}
            >
              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${consent.location ? 'left-4' : 'left-0.5'}`}></div>
            </button>
          </div>

        </div>

      </CardContent>
    </Card>
  );
}
