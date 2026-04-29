// Decision Engine — scores each card and recommends an action.
//
// Uses market price + configurable rules to output one of:
//   SELL_FAST   — price to move quickly, low margin but fast turnover
//   SELL_MAX    — list at or above market, worth the wait
//   GRADE       — condition + value suggest professional grading for ROI
//   HOLD        — price may rise, worth sitting on
//   BULK_LOT    — very low value, available as option but not actively pushed
//
// The engine is a pure function — no side effects, no API calls.

import type { ScannedCard, Condition } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Recommendation =
  | "SELL_FAST"
  | "SELL_MAX"
  | "GRADE"
  | "HOLD"
  | "BULK_LOT";

export interface CardDecision {
  recommendation: Recommendation;
  confidence: number;       // 0–1 how confident the engine is
  reasoning: string;        // Human-readable explanation
  color: "green" | "yellow" | "blue" | "purple" | "gray";
  icon: "zap" | "trending-up" | "award" | "clock" | "package";
  profitScore: number;      // 0–100, higher = more profitable to act on
}

/** User-configurable thresholds that drive decisions. */
export interface DecisionRules {
  // Price boundaries (USD)
  bulkLotCeiling: number;         // Cards at or below this → BULK_LOT option
  sellFastCeiling: number;        // Cards between bulkLot and this → SELL_FAST
  gradeFloor: number;             // Cards above this + good condition → GRADE
  holdFloor: number;              // Cards above this in rising categories → HOLD

  // Condition rules
  gradeMinCondition: Condition;   // Minimum condition to suggest grading
  gradingCostUsd: number;         // Estimated grading cost (for ROI calc)
  gradeMultiplier: number;        // Expected price multiplier after grading (e.g. 2.0 = 2x)

  // Behavior flags
  enableBulkLot: boolean;         // Whether to show BULK_LOT recommendations
  enableHold: boolean;            // Whether to show HOLD recommendations
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_DECISION_RULES: DecisionRules = {
  bulkLotCeiling: 0.50,
  sellFastCeiling: 5.00,
  gradeFloor: 20.00,
  holdFloor: 50.00,
  gradeMinCondition: "Near Mint",
  gradingCostUsd: 20.00,
  gradeMultiplier: 2.0,
  enableBulkLot: true,
  enableHold: true,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const CONDITION_RANK: Record<Condition, number> = {
  "Near Mint": 5,
  "Lightly Played": 4,
  "Moderately Played": 3,
  "Heavily Played": 2,
  "Damaged": 1,
};

function conditionMeetsMinimum(card: Condition, minimum: Condition): boolean {
  return CONDITION_RANK[card] >= CONDITION_RANK[minimum];
}

/** Estimate grading ROI: (graded value - grading cost - current value) / current value */
function gradingROI(
  currentPrice: number,
  gradingCost: number,
  gradeMultiplier: number
): number {
  const gradedValue = currentPrice * gradeMultiplier;
  const profit = gradedValue - gradingCost - currentPrice;
  return currentPrice > 0 ? profit / currentPrice : 0;
}

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export function evaluateCard(
  card: ScannedCard,
  rules: DecisionRules = DEFAULT_DECISION_RULES
): CardDecision {
  const price = card.marketPriceUsd ?? 0;
  const condition = card.condition;
  const isFoil = card.foil;
  const isSlabbed = card.slabbed ?? false;

  // Already graded — skip grading suggestion, focus on sell strategy
  if (isSlabbed) {
    return price >= rules.sellFastCeiling
      ? makeSellMax(price, "Already graded — list at or above market value for maximum return.")
      : makeSellFast(price, "Already graded — price to move. Graded cards at this price point sell best when competitively priced.");
  }

  // ── GRADE check (highest priority for raw high-value cards) ──
  if (
    price >= rules.gradeFloor &&
    conditionMeetsMinimum(condition, rules.gradeMinCondition)
  ) {
    const roi = gradingROI(price, rules.gradingCostUsd, rules.gradeMultiplier);
    if (roi > 0.3) {
      // ROI > 30% — strong grading candidate
      const estimatedGradedValue = price * rules.gradeMultiplier;
      return makeGrade(
        price,
        roi,
        `Worth grading — ${condition} condition at $${price.toFixed(2)} could be worth ~$${estimatedGradedValue.toFixed(2)} graded (${(roi * 100).toFixed(0)}% estimated ROI after $${rules.gradingCostUsd} grading cost).`
      );
    }
  }

  // ── HOLD check (high-value cards that may appreciate) ──
  if (rules.enableHold && price >= rules.holdFloor) {
    // Foil/high-rarity cards in good condition tend to appreciate
    if (
      isFoil &&
      conditionMeetsMinimum(condition, "Lightly Played")
    ) {
      return makeHold(
        price,
        `Foil card at $${price.toFixed(2)} in ${condition} — consider holding for price appreciation. High-value foils often trend upward.`
      );
    }
  }

  // ── SELL_MAX (mid-to-high value, worth listing at market) ──
  if (price >= rules.sellFastCeiling) {
    const reason = isFoil
      ? `Foil at $${price.toFixed(2)} — list at or above market price. Foils command premium from collectors.`
      : `$${price.toFixed(2)} market value — list at market price or higher. Worth the wait for full value.`;
    return makeSellMax(price, reason);
  }

  // ── SELL_FAST (low-mid value, price to move) ──
  if (price > rules.bulkLotCeiling) {
    return makeSellFast(
      price,
      `$${price.toFixed(2)} — price competitively to sell quickly. Undercut market slightly for fast turnover.`
    );
  }

  // ── BULK_LOT (very low value) ──
  if (rules.enableBulkLot && price <= rules.bulkLotCeiling && price > 0) {
    return makeBulkLot(
      price,
      `$${price.toFixed(2)} — low individual value. Can be sold individually for small margins or grouped into a bulk lot.`
    );
  }

  // ── No price data — default to SELL_FAST with low confidence ──
  if (price === 0) {
    return {
      recommendation: "SELL_FAST",
      confidence: 0.3,
      reasoning: "No market price available — list at your own price. Look up recent sold listings for reference.",
      color: "yellow",
      icon: "zap",
      profitScore: 20,
    };
  }

  // Fallback
  return makeSellFast(price, `$${price.toFixed(2)} — list to sell.`);
}

// ---------------------------------------------------------------------------
// Decision constructors
// ---------------------------------------------------------------------------

function makeSellFast(price: number, reasoning: string): CardDecision {
  return {
    recommendation: "SELL_FAST",
    confidence: 0.8,
    reasoning,
    color: "green",
    icon: "zap",
    profitScore: Math.min(40, Math.round(price * 5)),
  };
}

function makeSellMax(price: number, reasoning: string): CardDecision {
  return {
    recommendation: "SELL_MAX",
    confidence: 0.85,
    reasoning,
    color: "green",
    icon: "trending-up",
    profitScore: Math.min(90, Math.round(30 + price * 0.8)),
  };
}

function makeGrade(price: number, roi: number, reasoning: string): CardDecision {
  return {
    recommendation: "GRADE",
    confidence: Math.min(0.9, 0.6 + roi * 0.3),
    reasoning,
    color: "blue",
    icon: "award",
    profitScore: Math.min(95, Math.round(50 + roi * 40)),
  };
}

function makeHold(price: number, reasoning: string): CardDecision {
  return {
    recommendation: "HOLD",
    confidence: 0.6,
    reasoning,
    color: "purple",
    icon: "clock",
    profitScore: Math.min(70, Math.round(20 + price * 0.3)),
  };
}

function makeBulkLot(price: number, reasoning: string): CardDecision {
  return {
    recommendation: "BULK_LOT",
    confidence: 0.75,
    reasoning,
    color: "gray",
    icon: "package",
    profitScore: Math.max(5, Math.round(price * 10)),
  };
}

// ---------------------------------------------------------------------------
// Labels and display helpers
// ---------------------------------------------------------------------------

export const RECOMMENDATION_LABELS: Record<Recommendation, string> = {
  SELL_FAST: "Sell Fast",
  SELL_MAX: "Sell Max",
  GRADE: "Grade",
  HOLD: "Hold",
  BULK_LOT: "Bulk Lot",
};

export const RECOMMENDATION_DESCRIPTIONS: Record<Recommendation, string> = {
  SELL_FAST: "Price competitively for quick turnover",
  SELL_MAX: "List at or above market for maximum value",
  GRADE: "Consider professional grading for higher returns",
  HOLD: "Hold for potential price appreciation",
  BULK_LOT: "Low individual value — sell individually or group",
};
