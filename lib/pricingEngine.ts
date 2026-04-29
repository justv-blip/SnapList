// Smart Pricing Engine — computes optimal list prices for cards.
//
// Strategies:
//   MATCH_MARKET  — list at market price exactly
//   UNDERCUT      — list X% below market to sell faster
//   MARKUP        — list X% above market for higher margins
//   FLOOR_CEILING — clamp to a min/max range after applying multiplier
//   VELOCITY      — aggressive undercut for quick liquidation
//
// The engine is a pure function — no side effects, no API calls.

import type { ExportPlatform, ScannedCard } from "./types";
import { calculateFees, minimumPriceForProfit, DEFAULT_SELLER_COSTS, type FeeBreakdown, type SellerCosts } from "./platformFees";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PricingStrategy =
  | "MATCH_MARKET"
  | "UNDERCUT"
  | "MARKUP"
  | "FLOOR_CEILING"
  | "VELOCITY";

export type RoundingRule =
  | "none"
  | "nearest_quarter"    // round to nearest $0.25
  | "end_49"            // e.g. $4.49, $9.49
  | "end_99"            // e.g. $4.99, $9.99
  | "end_95"            // e.g. $4.95, $9.95
  | "round_dollar";     // round to nearest whole dollar

export interface PricingConfig {
  strategy: PricingStrategy;
  undercutPercent: number;       // e.g. 5 = undercut by 5%
  markupPercent: number;         // e.g. 15 = mark up by 15%
  floorPrice: number;            // minimum list price (USD)
  ceilingPrice: number;          // maximum list price (0 = no ceiling)
  rounding: RoundingRule;
  minimumMargin: number;         // won't price below this absolute amount
  velocityMultiplier: number;    // for VELOCITY strategy, how aggressively to undercut (0.7 = 30% below)
  applyToFoilsOnly: boolean;     // if true, only apply markup to foils
  freeShippingThreshold: number; // above this price, assume free shipping is baked in
  // ---- Fee-aware pricing ----
  targetPlatform: ExportPlatform;  // platform to calculate fees for
  sellerCosts: SellerCosts;        // shipping, COGS, promoted rate
  minimumProfit: number;           // won't price below this net profit (USD), 0 = disabled
}

export interface PricingResult {
  listPrice: number;
  marketPrice: number;
  adjustment: number;            // difference from market price
  adjustmentPercent: number;     // % change from market
  strategy: PricingStrategy;
  reasoning: string;
  belowFloor: boolean;           // true if card was below floor price
  aboveCeiling: boolean;         // true if card was capped by ceiling
  wasRounded: boolean;           // true if rounding was applied
  // ---- Fee-aware fields ----
  fees: FeeBreakdown;            // full fee breakdown for the target platform
  netProfit: number;             // profit after all fees, shipping, COGS
  marginPercent: number;         // profit as % of sale price
  profitWarning: "loss" | "thin" | "healthy" | null; // quick health indicator
}

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  strategy: "MATCH_MARKET",
  undercutPercent: 5,
  markupPercent: 10,
  floorPrice: 0.99,
  ceilingPrice: 0,
  rounding: "end_99",
  minimumMargin: 0.25,
  velocityMultiplier: 0.75,
  applyToFoilsOnly: false,
  freeShippingThreshold: 25,
  targetPlatform: "ebay",
  sellerCosts: { ...DEFAULT_SELLER_COSTS },
  minimumProfit: 0,
};

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

export const PRICING_STRATEGY_LABELS: Record<PricingStrategy, string> = {
  MATCH_MARKET: "Match Market",
  UNDERCUT: "Undercut",
  MARKUP: "Markup",
  FLOOR_CEILING: "Floor / Ceiling",
  VELOCITY: "Quick Sell",
};

export const PRICING_STRATEGY_DESCRIPTIONS: Record<PricingStrategy, string> = {
  MATCH_MARKET: "List at current market price",
  UNDERCUT: "Price below market to sell faster",
  MARKUP: "Price above market for higher margins",
  FLOOR_CEILING: "Apply multiplier within a price range",
  VELOCITY: "Aggressive pricing for fast liquidation",
};

export const ROUNDING_LABELS: Record<RoundingRule, string> = {
  none: "No rounding",
  nearest_quarter: "Nearest $0.25",
  end_49: "End in .49",
  end_99: "End in .99",
  end_95: "End in .95",
  round_dollar: "Nearest dollar",
};

// ---------------------------------------------------------------------------
// Core engine
// ---------------------------------------------------------------------------

export function computeListPrice(
  card: ScannedCard,
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): PricingResult {
  const market = card.marketPriceUsd ?? 0;

  // No market price — can't compute
  if (market <= 0) {
    const fallback = config.floorPrice > 0 ? config.floorPrice : 0;
    const fallbackFees = calculateFees(fallback, config.targetPlatform, config.sellerCosts);
    return {
      listPrice: fallback,
      marketPrice: 0,
      adjustment: 0,
      adjustmentPercent: 0,
      strategy: config.strategy,
      reasoning: "No market price available — using floor price or manual pricing needed.",
      belowFloor: false,
      aboveCeiling: false,
      wasRounded: false,
      fees: fallbackFees,
      netProfit: fallbackFees.netProfit,
      marginPercent: fallbackFees.marginPercent,
      profitWarning: fallback <= 0 ? null : fallbackFees.netProfit < 0 ? "loss" : fallbackFees.marginPercent < 10 ? "thin" : "healthy",
    };
  }

  let raw: number;
  let reasoning: string;

  switch (config.strategy) {
    case "MATCH_MARKET":
      raw = market;
      reasoning = `Matched market price at $${market.toFixed(2)}.`;
      break;

    case "UNDERCUT": {
      const cut = market * (config.undercutPercent / 100);
      raw = market - cut;
      reasoning = `Undercut market by ${config.undercutPercent}% ($${cut.toFixed(2)} below $${market.toFixed(2)}).`;
      break;
    }

    case "MARKUP": {
      // If applyToFoilsOnly is set, only mark up foil cards
      if (config.applyToFoilsOnly && !card.foil) {
        raw = market;
        reasoning = `Non-foil card — markup only applies to foils. Listed at market ($${market.toFixed(2)}).`;
      } else {
        const up = market * (config.markupPercent / 100);
        raw = market + up;
        reasoning = `Marked up ${config.markupPercent}% ($${up.toFixed(2)} above $${market.toFixed(2)}).`;
      }
      break;
    }

    case "FLOOR_CEILING":
      raw = market;
      reasoning = `Market price $${market.toFixed(2)} clamped to floor/ceiling range.`;
      break;

    case "VELOCITY": {
      raw = market * config.velocityMultiplier;
      const discount = ((1 - config.velocityMultiplier) * 100).toFixed(0);
      reasoning = `Quick sell: ${discount}% below market ($${market.toFixed(2)} → $${raw.toFixed(2)}).`;
      break;
    }

    default:
      raw = market;
      reasoning = "Default: matched market price.";
  }

  // Apply minimum margin
  if (raw < config.minimumMargin && config.minimumMargin > 0) {
    raw = config.minimumMargin;
  }

  // Apply floor
  let belowFloor = false;
  if (config.floorPrice > 0 && raw < config.floorPrice) {
    raw = config.floorPrice;
    belowFloor = true;
    reasoning += ` Raised to floor price ($${config.floorPrice.toFixed(2)}).`;
  }

  // Apply ceiling
  let aboveCeiling = false;
  if (config.ceilingPrice > 0 && raw > config.ceilingPrice) {
    raw = config.ceilingPrice;
    aboveCeiling = true;
    reasoning += ` Capped at ceiling ($${config.ceilingPrice.toFixed(2)}).`;
  }

  // Apply rounding
  const rounded = applyRounding(raw, config.rounding);
  const wasRounded = rounded !== raw;
  if (wasRounded) {
    reasoning += ` Rounded to $${rounded.toFixed(2)}.`;
  }

  // Re-apply floor after rounding (rounding might push below floor)
  let final = config.floorPrice > 0 && rounded < config.floorPrice
    ? config.floorPrice
    : rounded;

  // Enforce minimum profit — bump price up if net profit would be too low
  if (config.minimumProfit > 0) {
    const checkFees = calculateFees(final, config.targetPlatform, config.sellerCosts);
    if (checkFees.netProfit < config.minimumProfit) {
      const minPrice = minimumPriceForProfit(config.minimumProfit, config.targetPlatform, config.sellerCosts);
      if (minPrice > final) {
        final = applyRounding(minPrice, config.rounding);
        // Re-check: rounding might have pushed below minPrice
        if (final < minPrice) final = minPrice;
        reasoning += ` Raised to $${final.toFixed(2)} to meet minimum profit of $${config.minimumProfit.toFixed(2)}.`;
      }
    }
  }

  final = Math.round(final * 100) / 100;

  // Calculate fee breakdown at the final price
  const fees = calculateFees(final, config.targetPlatform, config.sellerCosts);
  const profitWarning: PricingResult["profitWarning"] =
    fees.netProfit < 0 ? "loss" : fees.marginPercent < 10 ? "thin" : "healthy";

  return {
    listPrice: final,
    marketPrice: market,
    adjustment: Math.round((final - market) * 100) / 100,
    adjustmentPercent: market > 0 ? Math.round(((final - market) / market) * 10000) / 100 : 0,
    strategy: config.strategy,
    reasoning,
    belowFloor,
    aboveCeiling,
    wasRounded,
    fees,
    netProfit: fees.netProfit,
    marginPercent: fees.marginPercent,
    profitWarning,
  };
}

// ---------------------------------------------------------------------------
// Rounding helpers
// ---------------------------------------------------------------------------

function applyRounding(price: number, rule: RoundingRule): number {
  switch (rule) {
    case "none":
      return price;

    case "nearest_quarter":
      return Math.round(price * 4) / 4;

    case "end_49": {
      const base = Math.floor(price);
      return price - base >= 0.49 ? base + 0.49 : (base > 0 ? base - 1 + 0.49 : 0.49);
    }

    case "end_99": {
      const base = Math.floor(price);
      if (price - base >= 0.99) return base + 0.99;
      return base > 0 ? base - 1 + 0.99 : 0.99;
    }

    case "end_95": {
      const base = Math.floor(price);
      if (price - base >= 0.95) return base + 0.95;
      return base > 0 ? base - 1 + 0.95 : 0.95;
    }

    case "round_dollar":
      return Math.round(price);

    default:
      return price;
  }
}

// ---------------------------------------------------------------------------
// Batch pricing — apply to an array of cards
// ---------------------------------------------------------------------------

export function computeBatchPricing(
  cards: ScannedCard[],
  config: PricingConfig = DEFAULT_PRICING_CONFIG
): { card: ScannedCard; pricing: PricingResult }[] {
  return cards.map((card) => ({
    card,
    pricing: computeListPrice(card, config),
  }));
}

// Quick stats for a batch of pricing results
export function pricingBatchStats(results: PricingResult[]): {
  totalMarketValue: number;
  totalListValue: number;
  totalAdjustment: number;
  avgAdjustmentPercent: number;
  belowFloorCount: number;
  aboveCeilingCount: number;
  // Fee-aware stats
  totalFees: number;
  totalNetProfit: number;
  avgMarginPercent: number;
  lossCount: number;
  thinMarginCount: number;
} {
  const totalMarketValue = results.reduce((s, r) => s + r.marketPrice, 0);
  const totalListValue = results.reduce((s, r) => s + r.listPrice, 0);
  const totalAdjustment = totalListValue - totalMarketValue;
  const withPrice = results.filter((r) => r.marketPrice > 0);
  const avgAdjustmentPercent =
    withPrice.length > 0
      ? withPrice.reduce((s, r) => s + r.adjustmentPercent, 0) / withPrice.length
      : 0;

  // Fee-aware aggregates
  const totalFees = results.reduce((s, r) => s + (r.fees?.totalFees || 0), 0);
  const totalNetProfit = results.reduce((s, r) => s + r.netProfit, 0);
  const withListPrice = results.filter((r) => r.listPrice > 0);
  const avgMarginPercent =
    withListPrice.length > 0
      ? withListPrice.reduce((s, r) => s + r.marginPercent, 0) / withListPrice.length
      : 0;

  return {
    totalMarketValue: Math.round(totalMarketValue * 100) / 100,
    totalListValue: Math.round(totalListValue * 100) / 100,
    totalAdjustment: Math.round(totalAdjustment * 100) / 100,
    avgAdjustmentPercent: Math.round(avgAdjustmentPercent * 100) / 100,
    belowFloorCount: results.filter((r) => r.belowFloor).length,
    aboveCeilingCount: results.filter((r) => r.aboveCeiling).length,
    totalFees: Math.round(totalFees * 100) / 100,
    totalNetProfit: Math.round(totalNetProfit * 100) / 100,
    avgMarginPercent: Math.round(avgMarginPercent * 100) / 100,
    lossCount: results.filter((r) => r.profitWarning === "loss").length,
    thinMarginCount: results.filter((r) => r.profitWarning === "thin").length,
  };
}
