"use client";

import { useState, useMemo } from "react";
import {
  AlertTriangle,
  Merge,
  Trash2,
  Check,
  X,
  Copy,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { ScannedCard } from "@/lib/types";
import { detectDuplicates, mergeCards, type DuplicateGroup } from "@/lib/duplicates";

interface DuplicateReviewProps {
  cards: ScannedCard[];
  onResolve: (updatedCards: ScannedCard[]) => void;
  onDismiss: () => void;
}

/**
 * Modal / panel that shows detected duplicate cards and lets the user
 * merge them, keep both, or remove one.
 */
export function DuplicateReview({ cards, onResolve, onDismiss }: DuplicateReviewProps) {
  const groups = useMemo(() => detectDuplicates(cards), [cards]);
  const [resolved, setResolved] = useState<Set<number>>(new Set());
  const [actions, setActions] = useState<Map<number, "merge" | "keep" | "remove">>(new Map());
  const [expandedGroup, setExpandedGroup] = useState<number | null>(groups.length > 0 ? 0 : null);

  if (groups.length === 0) {
    return (
      <div className="card-panel text-center py-8">
        <Check className="w-8 h-8 text-accent2 mx-auto mb-3" />
        <h3 className="font-semibold mb-1">No duplicates found</h3>
        <p className="text-sm text-muted">All cards in this batch are unique.</p>
        <button className="btn-primary mt-4" onClick={onDismiss}>
          Continue
        </button>
      </div>
    );
  }

  const handleAction = (groupIndex: number, action: "merge" | "keep" | "remove") => {
    setActions((prev) => new Map(prev).set(groupIndex, action));
    setResolved((prev) => new Set(prev).add(groupIndex));
  };

  const handleApplyAll = () => {
    let updatedCards = [...cards];

    groups.forEach((group, i) => {
      const action = actions.get(i) ?? "keep";
      if (action === "merge") {
        // Merge duplicates into primary
        let merged = group.primary;
        const removeIds = new Set<string>();
        for (const dup of group.duplicates) {
          merged = mergeCards(merged, dup);
          removeIds.add(dup.id);
        }
        updatedCards = updatedCards
          .filter((c) => !removeIds.has(c.id))
          .map((c) => (c.id === group.primary.id ? merged : c));
      } else if (action === "remove") {
        // Remove the duplicates, keep primary
        const removeIds = new Set(group.duplicates.map((d) => d.id));
        updatedCards = updatedCards.filter((c) => !removeIds.has(c.id));
      }
      // "keep" = do nothing
    });

    onResolve(updatedCards);
  };

  const allResolved = resolved.size === groups.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
          <AlertTriangle className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h3 className="font-semibold">
            {groups.length} potential duplicate{groups.length > 1 ? "s" : ""} found
          </h3>
          <p className="text-xs text-muted">
            Review each group and choose how to handle them
          </p>
        </div>
      </div>

      {/* Groups */}
      {groups.map((group, i) => {
        const isExpanded = expandedGroup === i;
        const action = actions.get(i);
        const isResolved = resolved.has(i);

        return (
          <div
            key={i}
            className={`card-panel transition-colors ${
              isResolved ? "border-accent2/30 bg-accent2/[0.02]" : ""
            }`}
          >
            {/* Group header */}
            <button
              className="w-full flex items-center gap-3 text-left"
              onClick={() => setExpandedGroup(isExpanded ? null : i)}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-sm truncate">{group.primary.name}</p>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-panel2 border border-border text-muted font-medium">
                    {group.duplicates.length + 1} cards
                  </span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 border border-accent/20 text-accent font-medium">
                    {Math.round(group.confidence * 100)}% match
                  </span>
                  {isResolved && action && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent2/10 border border-accent2/20 text-accent2 font-medium">
                      {action === "merge" ? "Will merge" : action === "remove" ? "Will remove dupes" : "Keeping all"}
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted mt-0.5">
                  {group.primary.setName ?? group.primary.game}
                  {group.primary.collectorNumber ? ` #${group.primary.collectorNumber}` : ""}
                </p>
              </div>
              {isExpanded ? (
                <ChevronUp className="w-4 h-4 text-muted shrink-0" />
              ) : (
                <ChevronDown className="w-4 h-4 text-muted shrink-0" />
              )}
            </button>

            {/* Expanded details */}
            {isExpanded && (
              <div className="mt-4 space-y-3">
                {/* Card list */}
                <div className="space-y-2">
                  {[group.primary, ...group.duplicates].map((card, ci) => (
                    <div
                      key={card.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg border ${
                        ci === 0
                          ? "bg-accent2/5 border-accent2/20"
                          : "bg-panel2 border-border"
                      }`}
                    >
                      {card.imageUrl ? (
                        <img
                          src={card.imageUrl}
                          alt=""
                          className="w-10 h-14 rounded object-cover shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-14 rounded bg-panel border border-border shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{card.name}</p>
                          {ci === 0 && (
                            <span className="text-[10px] text-accent2 font-medium">Primary</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted">
                          {card.condition} · {card.language} · Qty: {card.quantity}
                          {card.foil ? " · Foil" : ""}
                        </p>
                        {card.marketPriceUsd != null && (
                          <p className="text-[10px] text-muted">${card.marketPriceUsd.toFixed(2)}</p>
                        )}
                      </div>
                      <p className="text-[10px] text-muted shrink-0">
                        {card.identificationConfidence
                          ? `${Math.round(card.identificationConfidence * 100)}% conf`
                          : "Manual"}
                      </p>
                    </div>
                  ))}
                </div>

                {/* Action buttons */}
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    className={`btn text-xs ${action === "merge" ? "border-accent2/40 bg-accent2/10 text-accent2" : ""}`}
                    onClick={() => handleAction(i, "merge")}
                  >
                    <Merge className="w-3.5 h-3.5" />
                    Merge into one
                  </button>
                  <button
                    className={`btn text-xs ${action === "remove" ? "border-danger/40 bg-danger/10 text-danger" : ""}`}
                    onClick={() => handleAction(i, "remove")}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Remove duplicates
                  </button>
                  <button
                    className={`btn text-xs ${action === "keep" ? "border-accent/40 bg-accent/10 text-accent" : ""}`}
                    onClick={() => handleAction(i, "keep")}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Keep all
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Apply / Dismiss */}
      <div className="flex gap-3 justify-end pt-2">
        <button className="btn" onClick={onDismiss}>
          Skip
        </button>
        <button
          className="btn-primary"
          onClick={handleApplyAll}
          disabled={!allResolved}
        >
          <Check className="w-4 h-4" />
          Apply {resolved.size}/{groups.length} resolved
        </button>
      </div>
    </div>
  );
}
