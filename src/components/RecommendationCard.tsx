import { Recommendation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export function RecommendationCard({ data, loading }: { data?: { recommendation: Recommendation, narration: string }, loading: boolean }) {
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return (
      <Card className="border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] animate-pulse">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Analyzing Profile...
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-4 bg-gray-800 rounded w-3/4 mb-2"></div>
          <div className="h-4 bg-gray-800 rounded w-1/2"></div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { recommendation, narration } = data;

  return (
    <Card className="border-indigo-500/50 shadow-[0_0_20px_rgba(99,102,241,0.2)] bg-gradient-to-br from-gray-950 to-indigo-950/30">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <CardTitle className="text-xl flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-400" />
            Agentic Recommendation
          </CardTitle>
          {recommendation.confidence > 0 && (
            <div className="text-xs bg-indigo-500/20 text-indigo-300 px-2 py-1 rounded border border-indigo-500/30">
              Confidence: {(recommendation.confidence * 100).toFixed(0)}%
            </div>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* The Product */}
        <div className="bg-gray-900/50 rounded-lg p-4 border border-white/5">
          <div className="text-sm text-gray-400 mb-1">Recommended Product</div>
          <div className="text-2xl font-bold text-white tracking-wide">
            {recommendation.product.replace(/_/g, " ")}
          </div>
        </div>

        {/* The Narration */}
        <div className="text-gray-300 leading-relaxed text-sm">
          {narration}
        </div>

        {/* Explainability Section */}
        <div className="pt-2">
          <button 
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 transition-colors w-full p-2 -mx-2 rounded hover:bg-white/5"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            Why this recommendation? (Explainability Trace)
          </button>
          
          {expanded && (
            <div className="mt-3 bg-black/40 border border-white/10 rounded-md p-4 text-xs font-mono text-gray-400">
              <div className="text-indigo-400 mb-2 font-sans font-semibold">Deterministic Reason Trace:</div>
              <ul className="space-y-2">
                {recommendation.reasonTrace.map((trace, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-gray-600">[{i+1}]</span>
                    <span>{trace}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
