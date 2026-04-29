"use client";

import { useState } from "react";
import {
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Info,
  ChevronDown,
  ChevronRight,
  Shield,
  X,
} from "lucide-react";
import type { BatchValidationResult, CardValidationResult, ValidationSeverity } from "@/lib/listingValidation";

interface Props {
  result: BatchValidationResult;
  platform: string;
  onClose: () => void;
  onProceed?: () => void;  // called when user clicks "Export anyway" (only if valid)
}

const SEVERITY_ICON: Record<ValidationSeverity, typeof XCircle> = {
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

const SEVERITY_COLOR: Record<ValidationSeverity, string> = {
  error: "text-danger",
  warning: "text-amber-400",
  info: "text-muted",
};

const SEVERITY_BG: Record<ValidationSeverity, string> = {
  error: "bg-danger/10 border-danger/30",
  warning: "bg-amber-400/10 border-amber-400/30",
  info: "bg-panel2 border-border",
};

export default function ValidationReport({ result, platform, onClose, onProceed }: Props) {
  const [expandedCards, setExpandedCards] = useState<Set<string>>(() => {
    // Auto-expand cards with errors
    const set = new Set<string>();
    for (const card of result.cards) {
      if (card.hasErrors) set.add(card.cardId);
    }
    return set;
  });

  const toggleCard = (id: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Only show cards that have issues
  const cardsWithIssues = result.cards.filter((c) => c.issues.length > 0);
  const cleanCards = result.cards.length - cardsWithIssues.length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card-panel max-w-lg w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              result.isValid ? "bg-accent2/10 border border-accent2/30" : "bg-danger/10 border border-danger/30"
            }`}>
              {result.isValid ? (
                <Shield className="w-5 h-5 text-accent2" />
              ) : (
                <XCircle className="w-5 h-5 text-danger" />
              )}
            </div>
            <div>
              <h3 className="font-semibold">Pre-flight Check</h3>
              <p className="text-xs text-muted capitalize">{platform} export</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="px-5 py-3 border-b border-border flex items-center gap-4 text-sm">
          {result.totalErrors > 0 && (
            <span className="inline-flex items-center gap-1.5 text-danger">
              <XCircle className="w-3.5 h-3.5" />
              {result.totalErrors} error{result.totalErrors !== 1 ? "s" : ""}
            </span>
          )}
          {result.totalWarnings > 0 && (
            <span className="inline-flex items-center gap-1.5 text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              {result.totalWarnings} warning{result.totalWarnings !== 1 ? "s" : ""}
            </span>
          )}
          {cleanCards > 0 && (
            <span className="inline-flex items-center gap-1.5 text-accent2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {cleanCards} clean
            </span>
          )}
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {/* Batch-level issues */}
          {result.batchIssues.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted uppercase tracking-wider font-medium">Batch Issues</p>
              {result.batchIssues.map((issue, i) => {
                const Icon = SEVERITY_ICON[issue.severity];
                return (
                  <div
                    key={i}
                    className={`rounded-lg border p-3 ${SEVERITY_BG[issue.severity]}`}
                  >
                    <div className="flex items-start gap-2">
                      <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${SEVERITY_COLOR[issue.severity]}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">{issue.message}</p>
                        {issue.suggestion && (
                          <p className="text-xs text-muted mt-1">{issue.suggestion}</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Per-card issues */}
          {cardsWithIssues.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-muted uppercase tracking-wider font-medium">
                Card Issues ({cardsWithIssues.length} card{cardsWithIssues.length !== 1 ? "s" : ""})
              </p>
              {cardsWithIssues.map((card) => (
                <CardIssueRow
                  key={card.cardId}
                  card={card}
                  expanded={expandedCards.has(card.cardId)}
                  onToggle={() => toggleCard(card.cardId)}
                />
              ))}
            </div>
          )}

          {/* All clean */}
          {cardsWithIssues.length === 0 && result.batchIssues.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle2 className="w-12 h-12 text-accent2 mx-auto mb-3" />
              <p className="font-semibold text-accent2">All checks passed</p>
              <p className="text-sm text-muted mt-1">
                {result.cards.length} card{result.cards.length !== 1 ? "s" : ""} ready to export
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-border flex items-center justify-between">
          <p className="text-xs text-muted max-w-[60%]">{result.summary}</p>
          <div className="flex gap-3">
            <button className="btn" onClick={onClose}>
              {result.isValid ? "Go back" : "Fix issues"}
            </button>
            {result.isValid && onProceed && (
              <button className="btn-primary" onClick={onProceed}>
                {result.totalWarnings > 0 ? "Export anyway" : "Export"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function CardIssueRow({
  card,
  expanded,
  onToggle,
}: {
  card: CardValidationResult;
  expanded: boolean;
  onToggle: () => void;
}) {
  const errorCount = card.issues.filter((i) => i.severity === "error").length;
  const warningCount = card.issues.filter((i) => i.severity === "warning").length;

  return (
    <div className="rounded-lg border border-border bg-panel2">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-panel transition-colors rounded-lg"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted shrink-0" />
        )}
        <span className="text-sm font-medium truncate flex-1">{card.cardName}</span>
        <div className="flex items-center gap-2 shrink-0">
          {errorCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-danger">
              <XCircle className="w-3 h-3" /> {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-400">
              <AlertTriangle className="w-3 h-3" /> {warningCount}
            </span>
          )}
        </div>
      </button>
      {expanded && (
        <div className="px-3 pb-3 space-y-2">
          {card.issues.map((issue, i) => {
            const Icon = SEVERITY_ICON[issue.severity];
            return (
              <div
                key={i}
                className={`rounded-lg border p-2.5 ${SEVERITY_BG[issue.severity]}`}
              >
                <div className="flex items-start gap-2">
                  <Icon className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${SEVERITY_COLOR[issue.severity]}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">{issue.message}</p>
                    {issue.suggestion && (
                      <p className="text-[11px] text-muted mt-0.5">{issue.suggestion}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
