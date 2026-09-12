import { StressAlert } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { HeartPulse } from "lucide-react";

export function WellnessGauge({ data }: { data: StressAlert | null }) {
  if (!data) return null;

  const score = data.wellnessScore;

  let status = "Healthy";
  let color = "text-emerald-400";
  let bgColor = "bg-emerald-400";
  
  if (score < 70 && score >= 50) {
    status = "Warning";
    color = "text-amber-400";
    bgColor = "bg-amber-400";
  } else if (score < 50) {
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
      <CardContent className="flex flex-col items-center justify-center py-6 text-center">
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
        <div className="mt-2">
          <div className={`text-4xl font-bold ${color}`}>{score}</div>
          <div className="text-xs uppercase tracking-wider text-gray-400 mt-1">{status}</div>
        </div>
        {data.empatheticMessage && (
          <div className="mt-4 text-xs text-gray-300 bg-gray-900/50 p-3 rounded-lg border border-white/5 italic">
            "{data.empatheticMessage}"
          </div>
        )}
      </CardContent>
    </Card>
  );
}
