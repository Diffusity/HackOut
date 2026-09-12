import { Signals } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Activity } from "lucide-react";
import { Badge } from "./ui/badge";

export function SignalsCard({ signals }: { signals: Signals | null }) {
  if (!signals) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          Extracted Signals
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4 mt-2">
          {/* Salary Regularity */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Salary Regularity</span>
              <span>{(signals.salaryRegularityScore * 100).toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div 
                className="bg-emerald-400 h-1.5 rounded-full" 
                style={{ width: `${signals.salaryRegularityScore * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Savings Rate */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Savings Rate</span>
              <span>{(signals.savingsRate * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full bg-gray-800 rounded-full h-1.5">
              <div 
                className="bg-indigo-400 h-1.5 rounded-full" 
                style={{ width: `${signals.savingsRate * 100}%` }}
              ></div>
            </div>
          </div>

          {/* EMI Miss Count */}
          <div>
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Missed EMIs (90d)</span>
              <span className={signals.emiMissCount90d > 0 ? "text-rose-400 font-bold" : ""}>
                {signals.emiMissCount90d}
              </span>
            </div>
          </div>

          {/* Tags */}
          <div className="pt-2">
            <div className="text-xs text-gray-500 mb-2">Life Stage Tags</div>
            <div className="flex flex-wrap gap-2">
              {signals.lifeStageTags.map(tag => (
                <Badge key={tag} variant="secondary" className="text-[10px]">
                  {tag.replace(/_/g, " ")}
                </Badge>
              ))}
              {signals.lifeStageTags.length === 0 && (
                <span className="text-xs text-gray-600">No tags detected</span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
