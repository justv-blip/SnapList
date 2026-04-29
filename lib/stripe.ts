import Stripe from "stripe";

// Stripe singleton — reused across hot-reloads in dev
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

// Tier names as used by Stripe price env vars.
// Note: our DB uses "starter" but Stripe env vars use "lister" to match the product name.
// The TIER_MAP below handles the translation.
export type StripeTier = "lister" | "pro" | "business" | "enterprise";
export type BillingInterval = "monthly" | "annual";

// DB tier key → Stripe product name used in env vars
const TIER_MAP: Record<string, StripeTier> = {
  starter:    "lister",
  pro:        "pro",
  business:   "business",
  enterprise: "enterprise",
};

// Stripe product name → DB tier key
const REVERSE_TIER_MAP: Record<StripeTier, string> = {
  lister:     "starter",
  pro:        "pro",
  business:   "business",
  enterprise: "enterprise",
};

// Returns the Stripe Price ID for a given DB tier + billing interval.
// Price IDs are set in .env.local by the setup-stripe script.
export function getPriceId(dbTier: string, interval: BillingInterval): string | null {
  const stripeTier = TIER_MAP[dbTier];
  if (!stripeTier) return null;
  const key = `STRIPE_PRICE_${stripeTier.toUpperCase()}_${interval.toUpperCase()}`;
  return process.env[key] ?? null;
}

// Given a Stripe Price ID, returns the matching DB tier key ("starter", "pro", etc.)
export function getDbTierFromPriceId(priceId: string): string | null {
  const tiers: StripeTier[] = ["lister", "pro", "business", "enterprise"];
  const intervals: BillingInterval[] = ["monthly", "annual"];
  for (const tier of tiers) {
    for (const interval of intervals) {
      const key = `STRIPE_PRICE_${tier.toUpperCase()}_${interval.toUpperCase()}`;
      if (process.env[key] === priceId) return REVERSE_TIER_MAP[tier];
    }
  }
  return null;
}

// Human-readable product names shown in Stripe checkout
export const STRIPE_PRODUCT_NAMES: Record<StripeTier, string> = {
  lister:     "SnapList Lister",
  pro:        "SnapList Pro",
  business:   "SnapList Business",
  enterprise: "SnapList Enterprise",
};
