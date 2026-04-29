// Platform Fee Model — calculates real seller fees for each marketplace.
//
// Every platform takes a cut. This module defines the fee structures so
// sellers see their actual profit, not just revenue.
//
// Fee sources (as of 2025):
//   eBay:        13.25% FVF (CCG category) + $0.30 payment processing
//   TCGPlayer:   10.25% seller fee + $0.30 payment processing (standard)
//   Whatnot:     8% seller fee + 2.9% + $0.30 payment processing
//   Shopify:     2.9% + $0.30 (Shopify Payments, no platform commission)
//   Squarespace: 3% transaction fee + 2.9% + $0.30 (Business plan)

import type { ExportPlatform } from "./types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlatformFeeStructure {
  platform: ExportPlatform;
  label: string;
  /** Final-value fee as a decimal (e.g. 0.1325 = 13.25%) */
  fvfPercent: number;
  /** Payment processing fee as a decimal (e.g. 0.029 = 2.9%) */
  paymentPercent: number;
  /** Fixed per-transaction fee in USD */
  paymentFixed: number;
  /** Any additional platform fee percent (e.g. Squarespace 3% transaction fee) */
  additionalPercent: number;
  /** Promoted listing fee (optional, user-configurable) */
  promotedPercent: number;
  /** Whether this platform has configurable promoted listings */
  hasPromoted: boolean;
  /** Short description of fee structure */
  description: string;
}

export interface FeeBreakdown {
  platform: ExportPlatform;
  salePrice: number;
  /** Final-value / commission fee */
  fvfFee: number;
  /** Payment processing fee (percentage part) */
  paymentPercentFee: number;
  /** Payment processing fee (fixed part) */
  paymentFixedFee: number;
  /** Additional platform-specific fees */
  additionalFee: number;
  /** Promoted listing ad fee */
  promotedFee: number;
  /** Shipping cost (user-configurable) */
  shippingCost: number;
  /** Cost of goods (what seller paid for the card) — user-configurable */
  cogs: number;
  /** Total fees (all platform fees combined, NOT including shipping or COGS) */
  totalFees: number;
  /** Total deductions (fees + shipping + COGS) */
  totalDeductions: number;
  /** Net profit after all fees, shipping, and COGS */
  netProfit: number;
  /** Profit margin as a percentage of sale price */
  marginPercent: number;
  /** Effective fee rate (total fees / sale price) */
  effectiveFeeRate: number;
}

export interface SellerCosts {
  /** Standard shipping cost per card (e.g. $0.75 for PWE, $4.50 for tracked) */
  shippingCost: number;
  /** Cost of goods / acquisition cost per card (optional, user-set) */
  cogs: number;
  /** Promoted listing ad rate as decimal (0 = no promotion) */
  promotedRate: number;
}

// ---------------------------------------------------------------------------
// Fee structures per platform
// ---------------------------------------------------------------------------

export const PLATFORM_FEES: Record<ExportPlatform, PlatformFeeStructure> = {
  ebay: {
    platform: "ebay",
    label: "eBay",
    fvfPercent: 0.1325,       // 13.25% FVF for CCG category
    paymentPercent: 0.029,    // 2.9% managed payments
    paymentFixed: 0.30,       // $0.30 per order
    additionalPercent: 0,
    promotedPercent: 0,
    hasPromoted: true,
    description: "13.25% final value + 2.9% + $0.30 payment processing",
  },
  tcgplayer: {
    platform: "tcgplayer",
    label: "TCGPlayer",
    fvfPercent: 0.1025,       // 10.25% seller fee
    paymentPercent: 0,        // included in seller fee
    paymentFixed: 0.30,       // $0.30 per order
    additionalPercent: 0,
    promotedPercent: 0,
    hasPromoted: false,
    description: "10.25% seller fee + $0.30 per order",
  },
  whatnot: {
    platform: "whatnot",
    label: "Whatnot",
    fvfPercent: 0.08,         // 8% seller fee
    paymentPercent: 0.029,    // 2.9% payment processing
    paymentFixed: 0.30,       // $0.30 per transaction
    additionalPercent: 0,
    promotedPercent: 0,
    hasPromoted: false,
    description: "8% seller fee + 2.9% + $0.30 payment processing",
  },
  shopify: {
    platform: "shopify",
    label: "Shopify",
    fvfPercent: 0,            // No platform commission
    paymentPercent: 0.029,    // 2.9% Shopify Payments
    paymentFixed: 0.30,       // $0.30 per transaction
    additionalPercent: 0,
    promotedPercent: 0,
    hasPromoted: false,
    description: "2.9% + $0.30 (Shopify Payments, no platform fee)",
  },
  squarespace: {
    platform: "squarespace",
    label: "Squarespace",
    fvfPercent: 0,            // No commission on Commerce plans
    paymentPercent: 0.029,    // 2.9% Stripe processing
    paymentFixed: 0.30,       // $0.30 per transaction
    additionalPercent: 0.03,  // 3% transaction fee (Business plan)
    promotedPercent: 0,
    hasPromoted: false,
    description: "3% transaction fee + 2.9% + $0.30 processing",
  },
  generic: {
    platform: "generic",
    label: "Generic / Other",
    fvfPercent: 0,
    paymentPercent: 0,
    paymentFixed: 0,
    additionalPercent: 0,
    promotedPercent: 0,
    hasPromoted: false,
    description: "No fees (adjust manually)",
  },
};

// ---------------------------------------------------------------------------
// Default seller costs
// ---------------------------------------------------------------------------

export const DEFAULT_SELLER_COSTS: SellerCosts = {
  shippingCost: 0.75,   // PWE stamp cost
  cogs: 0,              // User must set their own cost basis
  promotedRate: 0,       // No promoted listings by default
};

// Shipping presets for quick selection
export const SHIPPING_PRESETS = [
  { label: "PWE (Plain White Envelope)", cost: 0.75 },
  { label: "PWE + Toploader", cost: 1.15 },
  { label: "Bubble Mailer", cost: 3.50 },
  { label: "USPS First Class Tracked", cost: 4.50 },
  { label: "Free Shipping (built into price)", cost: 0 },
] as const;

// ---------------------------------------------------------------------------
// Fee calculator
// ---------------------------------------------------------------------------

/**
 * Calculate the full fee breakdown for a sale on a given platform.
 */
export function calculateFees(
  salePrice: number,
  platform: ExportPlatform,
  costs: SellerCosts = DEFAULT_SELLER_COSTS
): FeeBreakdown {
  const fees = PLATFORM_FEES[platform];
  if (!fees || salePrice <= 0) {
    return emptyBreakdown(platform, salePrice, costs);
  }

  const fvfFee = round2(salePrice * fees.fvfPercent);
  const paymentPercentFee = round2(salePrice * fees.paymentPercent);
  const paymentFixedFee = fees.paymentFixed;
  const additionalFee = round2(salePrice * fees.additionalPercent);
  const promotedFee = round2(salePrice * (costs.promotedRate || fees.promotedPercent));

  const totalFees = round2(fvfFee + paymentPercentFee + paymentFixedFee + additionalFee + promotedFee);
  const totalDeductions = round2(totalFees + costs.shippingCost + costs.cogs);
  const netProfit = round2(salePrice - totalDeductions);
  const marginPercent = salePrice > 0 ? round2((netProfit / salePrice) * 100) : 0;
  const effectiveFeeRate = salePrice > 0 ? round2((totalFees / salePrice) * 100) : 0;

  return {
    platform,
    salePrice,
    fvfFee,
    paymentPercentFee,
    paymentFixedFee,
    additionalFee,
    promotedFee,
    shippingCost: costs.shippingCost,
    cogs: costs.cogs,
    totalFees,
    totalDeductions,
    netProfit,
    marginPercent,
    effectiveFeeRate,
  };
}

/**
 * Calculate the minimum sale price needed to achieve a target profit.
 * Useful for "I want to make at least $X on this card" reverse calculations.
 */
export function minimumPriceForProfit(
  targetProfit: number,
  platform: ExportPlatform,
  costs: SellerCosts = DEFAULT_SELLER_COSTS
): number {
  const fees = PLATFORM_FEES[platform];
  if (!fees) return targetProfit;

  // netProfit = salePrice - (salePrice * totalPct) - fixedCosts
  // targetProfit = salePrice * (1 - totalPct) - fixedCosts
  // salePrice = (targetProfit + fixedCosts) / (1 - totalPct)
  const totalPct = fees.fvfPercent + fees.paymentPercent + fees.additionalPercent + (costs.promotedRate || 0);
  const fixedCosts = fees.paymentFixed + costs.shippingCost + costs.cogs;

  if (totalPct >= 1) return Infinity; // Can never profit if fees ≥ 100%
  const minPrice = (targetProfit + fixedCosts) / (1 - totalPct);
  return round2(Math.max(minPrice, 0));
}

/**
 * Compare fees across all platforms for a given sale price.
 * Returns sorted by best net profit.
 */
export function comparePlatformFees(
  salePrice: number,
  costs: SellerCosts = DEFAULT_SELLER_COSTS
): FeeBreakdown[] {
  const platforms: ExportPlatform[] = ["ebay", "tcgplayer", "whatnot", "shopify", "squarespace"];
  return platforms
    .map((p) => calculateFees(salePrice, p, costs))
    .sort((a, b) => b.netProfit - a.netProfit);
}

// ---------------------------------------------------------------------------
// Batch fee summary
// ---------------------------------------------------------------------------

export interface BatchFeeStats {
  totalRevenue: number;
  totalFees: number;
  totalShipping: number;
  totalCogs: number;
  totalNetProfit: number;
  avgMarginPercent: number;
  avgEffectiveFeeRate: number;
  cardCount: number;
  lossCount: number;        // Cards selling at a loss
  thinMarginCount: number;  // Cards with margin < 10%
}

export function batchFeeStats(breakdowns: FeeBreakdown[]): BatchFeeStats {
  if (breakdowns.length === 0) {
    return {
      totalRevenue: 0, totalFees: 0, totalShipping: 0, totalCogs: 0,
      totalNetProfit: 0, avgMarginPercent: 0, avgEffectiveFeeRate: 0,
      cardCount: 0, lossCount: 0, thinMarginCount: 0,
    };
  }

  const totalRevenue = round2(breakdowns.reduce((s, b) => s + b.salePrice, 0));
  const totalFees = round2(breakdowns.reduce((s, b) => s + b.totalFees, 0));
  const totalShipping = round2(breakdowns.reduce((s, b) => s + b.shippingCost, 0));
  const totalCogs = round2(breakdowns.reduce((s, b) => s + b.cogs, 0));
  const totalNetProfit = round2(breakdowns.reduce((s, b) => s + b.netProfit, 0));

  const withPrice = breakdowns.filter((b) => b.salePrice > 0);
  const avgMarginPercent = withPrice.length > 0
    ? round2(withPrice.reduce((s, b) => s + b.marginPercent, 0) / withPrice.length)
    : 0;
  const avgEffectiveFeeRate = withPrice.length > 0
    ? round2(withPrice.reduce((s, b) => s + b.effectiveFeeRate, 0) / withPrice.length)
    : 0;

  return {
    totalRevenue,
    totalFees,
    totalShipping,
    totalCogs,
    totalNetProfit,
    avgMarginPercent,
    avgEffectiveFeeRate,
    cardCount: breakdowns.length,
    lossCount: breakdowns.filter((b) => b.netProfit < 0).length,
    thinMarginCount: breakdowns.filter((b) => b.marginPercent > 0 && b.marginPercent < 10).length,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function emptyBreakdown(platform: ExportPlatform, salePrice: number, costs: SellerCosts): FeeBreakdown {
  return {
    platform,
    salePrice,
    fvfFee: 0,
    paymentPercentFee: 0,
    paymentFixedFee: 0,
    additionalFee: 0,
    promotedFee: 0,
    shippingCost: costs.shippingCost,
    cogs: costs.cogs,
    totalFees: 0,
    totalDeductions: round2(costs.shippingCost + costs.cogs),
    netProfit: round2(salePrice - costs.shippingCost - costs.cogs),
    marginPercent: salePrice > 0 ? round2(((salePrice - costs.shippingCost - costs.cogs) / salePrice) * 100) : 0,
    effectiveFeeRate: 0,
  };
}
