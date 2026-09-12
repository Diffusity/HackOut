import { Signals } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { HeartPulse } from "lucide-react";

export function WellnessGauge({ signals }: { signals: Signals | null }) {
  if (!signals) return null;

  // Stub score calculation based on emiMissCount90d for the demo
  let score = 85; // Default healthy
  if (signals.emiMissCount90d === 1) score = 60;
  if (signals.emiMissCount90d >= 2) score = 35; // Sunita's demo score

  let status = "Healthy";
  let color = "text-emerald-400";
  let bgColor = "bg-emerald-400";
  
  if (score < 70 && score >= 40) {
    status = "Warning";
    color = "text-amber-400";
    bgColor = "bg-amber-400";
  } else if (score < 40) {
    status = "At Risk";
    color = "text-rose-400";
    bgColor = "bg-rose-400";
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <HeartPulse className={`w-5 h-5 ${color}`} />
          Financial Wellness
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center py-6">
        <div className="relative w-32 h-16 overflow-hidden">
          {/* Semi-circle gauge background */}
          <div className="absolute top-0 left-0 w-32 h-32 rounded-full border-[12px] border-gray-800 border-b-transparent border-r-transparent transform -rotate-45"></div>
          {/* Gauge fill */}
          <div 
            className={`absolute top-0 left-0 w-32 h-32 rounded-full border-[12px] ${color.replace('text', 'border')} border-b-transparent border-r-transparent transition-transform duration-1000 ease-out`}
            style={{ 
              transform: `rotate(${(-45 + (score / 100) * 180)}deg)`,
              clipPath: 'polygon(0 0, 100% 0, 100% 50%, 0 50%)'
            }}
          ></div>
        </div>
        <div className="mt-2 text-center">
          <div className={`text-4xl font-bold ${color}`}>{score}</div>
          <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">{status}</div>
        </div>
      </CardContent>
    </Card>
  );
}
