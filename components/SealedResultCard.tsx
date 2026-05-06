"use client";

import { useState } from "react";
import {
  Package,
  Tag,
  Globe,
  Star,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import type { SealedScanResult, SealedCondition } from "@/lib/types";
import { GAME_LABELS, SEALED_PRODUCT_LABELS, SEALED_CONDITION_LABELS } from "@/lib/types";

interface SealedResultCardProps {
  result: SealedScanResult;
  onConditionChange?: (condition: SealedCondition) => void;
  onSave?: (result: SealedScanResult) => void;
  saving?: boolean;
}

function ConfidenceBadge({ confidence }: { confidence: number }) {
  const pct = Math.round(confidence * 100);
  if (confidence >= 0.9) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/15 text-green-400 border border-green-500/20">
        <CheckCircle className="w-3 h-3" />
        High confidence · {pct}%
      </span>
    );
  }
  if (confidence >= 0.7) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-500/15 text-yellow-400 border border-yellow-500/20">
        <AlertCircle className="w-3 h-3" />
        Moderate · {pct}%
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/15 text-red-400 border border-red-500/20">
      <AlertCircle className="w-3 h-3" />
      Low confidence · {pct}%
    </span>
  );
}

function ProductTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-surface-2 text-muted border border-border">
      <Package className="w-3 h-3" />
      {SEALED_PRODUCT_LABELS[type as keyof typeof SEALED_PRODUCT_LABELS] ?? type}
    </span>
  );
}

export default function SealedResultCard({
  result,
  onConditionChange,
  onSave,
  saving = false,
}: SealedResultCardProps) {
  const { guess, marketPriceUsd, priceSource, priceSampleSize, condition } = result;
  const [showReasoning, setShowReasoning] = useState(false);
  const [currentCondition, setCurrentCondition] = useState<SealedCondition>(condition);

  const handleConditionChange = (c: SealedCondition) => {
    setCurrentCondition(c);
    onConditionChange?.(c);
  };

  const hasResult = guess.confidence > 0;
  const lowConfidence = guess.confidence < 0.5;

  return (
    <div className="rounded-xl border border-border bg-surface overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border bg-surface-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-foreground">
            {hasResult ? "Product Identified" : "Unable to Identify"}
          </span>
          {hasResult && <ConfidenceBadge confidence={guess.confidence} />}
        </div>
        {guess.productType && <ProductTypeBadge type={guess.productType} />}
      </div>

      <div className="p-4 space-y-4">
        {/* Low confidence warning */}
        {lowConfidence && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-400 text-sm">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>
              Low confidence scan — image may be blurry or product partially obscured. Please verify
              the details below.
            </span>
          </div>
        )}

        {/* Product name */}
        <div>
          <p className="text-xs text-muted uppercase tracking-wider mb-1">Product Name</p>
          <p className="text-lg font-semibold text-foreground">
            {guess.productName ?? (
              <span className="text-muted italic">Not identified</span>
            )}
          </p>
        </div>

        {/* Details grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {guess.game && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted uppercase tracking-wider flex items-center gap-1">
                <Tag className="w-3 h-3" /> Game
              </span>
              <span className="font-medium text-foreground">
                {GAME_LABELS[guess.game] ?? guess.game}
              </span>
            </div>
          )}

          {guess.setName && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted uppercase tracking-wider flex items-center gap-1">
                <Star className="w-3 h-3" /> Set
              </span>
              <span className="font-medium text-foreground">{guess.setName}</span>
            </div>
          )}

          {guess.language && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted uppercase tracking-wider flex items-center gap-1">
                <Globe className="w-3 h-3" /> Language
              </span>
              <span className="font-medium text-foreground">{guess.language}</span>
            </div>
          )}

          {guess.edition && (
            <div className="flex flex-col gap-0.5">
              <span className="text-xs text-muted uppercase tracking-wider">Edition</span>
              <span className="font-medium text-foreground">{guess.edition}</span>
            </div>
          )}
        </div>

        {/* Market price */}
        <div className="rounded-lg bg-surface-2 border border-border p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-brand" />
              <span className="text-sm font-medium text-foreground">Market Price</span>
            </div>
            {marketPriceUsd != null ? (
              <div className="text-right">
                <p className="text-xl font-bold text-foreground">
                  ${marketPriceUsd.toFixed(2)}
                </p>
                {priceSource && (
                  <p className="text-xs text-muted">
                    {priceSource}
                    {priceSampleSize != null ? ` · ${priceSampleSize} sales` : ""}
                  </p>
                )}
              </div>
            ) : (
              <span className="text-sm text-muted italic">No price data</span>
            )}
          </div>
        </div>

        {/* Condition selector */}
        <div>
          <p className="text-xs text-muted uppercase tracking-wider mb-2">Condition</p>
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(SEALED_CONDITION_LABELS) as SealedCondition[]).map((c) => (
              <button
                key={c}
                onClick={() => handleConditionChange(c)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  currentCondition === c
                    ? "bg-brand text-white border-brand"
                    : "bg-surface-2 text-muted border-border hover:border-brand/50 hover:text-foreground"
                }`}
              >
                {SEALED_CONDITION_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Reasoning toggle */}
        {guess.reasoning && (
          <div>
            <button
              onClick={() => setShowReasoning((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted hover:text-foreground transition-colors"
            >
              {showReasoning ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {showReasoning ? "Hide" : "Show"} AI reasoning
            </button>
            {showReasoning && (
              <p className="mt-2 text-xs text-muted bg-surface-2 rounded-lg p-3 border border-border leading-relaxed">
                {guess.reasoning}
              </p>
            )}
          </div>
        )}

        {/* Save button */}
        {onSave && (
          <button
            onClick={() => onSave({ ...result, condition: currentCondition })}
            disabled={saving || !hasResult}
            className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving…" : "Add to Collection"}
          </button>
        )}
      </div>
    </div>
  );
}
