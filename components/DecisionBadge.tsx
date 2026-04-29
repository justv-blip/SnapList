"use client";

import { useState } from "react";
import {
  Zap,
  TrendingUp,
  Award,
  Clock,
  Package,
  ChevronDown,
  ChevronUp,
  BarChart3,
} from "lucide-react";
import type { CardDecision, Recommendation } from "@/lib/decisionEngine";
import { RECOMMENDATION_LABELS } from "@/lib/decisionEngine";

const ICON_MAP: Record<CardDecision["icon"], typeof Zap> = {
  zap: Zap,
  "trending-up": TrendingUp,
  award: Award,
  clock: Clock,
  package: Package,
};

const COLOR_MAP: Record<CardDecision["color"], { bg: string; border: string; text: string }> = {
  green:  { bg: "bg-emerald-500/15", border: "border-emerald-500/40", text: "text-emerald-400" },
  yellow: { bg: "bg-amber-500/15",   border: "border-amber-500/40",   text: "text-amber-400" },
  blue:   { bg: "bg-blue-500/15",    border: "border-blue-500/40",    text: "text-blue-400" },
  purple: { bg: "bg-purple-500/15",  border: "border-purple-500/40",  text: "text-purple-400" },
  gray:   { bg: "bg-zinc-500/15",    border: "border-zinc-500/40",    text: "text-zinc-400" },
};

// ---------------------------------------------------------------------------
// Compact badge (for chip bar in CardRow)
// ---------------------------------------------------------------------------

export function DecisionChip({ decision }: { decision: CardDecision }) {
  const Icon = ICON_MAP[decision.icon];
  const colors = COLOR_MAP[decision.color];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${colors.bg} ${colors.border} ${colors.text}`}
      title={decision.reasoning}
    >
      <Icon className="w-3 h-3" />
      {RECOMMENDATION_LABELS[decision.recommendation]}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Expanded card (for detail view in CardRow)
// ---------------------------------------------------------------------------

export function DecisionCard({ decision }: { decision: CardDecision }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICON_MAP[decision.icon];
  const colors = COLOR_MAP[decision.color];

  return (
    <div className={`rounded-lg border ${colors.border} ${colors.bg} overflow-hidden`}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg} border ${colors.border}`}>
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-semibold ${colors.text}`}>
              {RECOMMENDATION_LABELS[decision.recommendation]}
            </span>
            <span className="text-[10px] text-muted">
              {Math.round(decision.confidence * 100)}% confident
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <BarChart3 className="w-3 h-3 text-muted" />
            <div className="flex-1 h-1.5 bg-panel2 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  decision.profitScore >= 70
                    ? "bg-emerald-500"
                    : decision.profitScore >= 40
                    ? "bg-amber-500"
                    : "bg-zinc-500"
                }`}
                style={{ width: `${decision.profitScore}%` }}
              />
            </div>
            <span className="text-[10px] text-muted w-6 text-right">
              {decision.profitScore}
            </span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted shrink-0" />
        )}
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          <p className="text-xs text-muted/90 leading-relaxed">
            {decision.reasoning}
          </p>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Profit score mini-bar (optional, for list views)
// ---------------------------------------------------------------------------

export function ProfitScoreBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-1.5" title={`Profit score: ${score}/100`}>
      <div className="w-12 h-1.5 bg-panel2 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${
            score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-zinc-500"
          }`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-[10px] text-muted">{score}</span>
    </div>
  );
}
