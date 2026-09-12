import { AuditEntry } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { ShieldCheck } from "lucide-react";
import { Badge } from "./ui/badge";

export function AuditLogPanel({ logs }: { logs: AuditEntry[] }) {
  if (!logs || logs.length === 0) return null;

  return (
    <Card className="border-gray-800 bg-gray-950/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2 text-gray-400">
          <ShieldCheck className="w-4 h-4 text-emerald-500" />
          Consent & Audit Ledger (DPDP Act)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {logs.map((log, idx) => (
            <div key={idx} className="bg-black/30 border border-white/5 rounded-md p-3 text-xs">
              <div className="flex justify-between items-start mb-2">
                <span className="text-gray-500 font-mono">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <Badge variant={log.consentVerified ? "success" : "destructive"} className="text-[10px] py-0">
                  {log.consentVerified ? "Consent Verified" : "Consent Denied"}
                </Badge>
              </div>
              <div className="text-gray-300">
                <span className="text-gray-500">Action:</span> {log.action}
              </div>
              <div className="text-gray-300 mt-1">
                <span className="text-gray-500">Data Accessed:</span> {log.dataAccessed.join(", ")}
              </div>
              <div className="text-indigo-400 mt-2 font-medium">
                {log.decision}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
