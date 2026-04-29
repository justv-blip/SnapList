// Scan limits per subscription tier (per calendar month).
// Shared between client (settings page) and server (API rate limiting).

export const TIER_LIMITS: Record<string, number> = {
  free: 30,           // $0/mo — 30 scans/mo
  starter: 300,       // $12/mo  — Lister
  pro: 1500,          // $29/mo  — Pro
  business: 6000,     // $59/mo  — Business
  enterprise: 100000, // $149/mo — Enterprise (effectively unlimited)
};

export const TIER_LABELS: Record<string, string> = {
  free: "Free",
  starter: "Lister",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
};

// Monthly prices in USD (used for Stripe checkout and display)
export const TIER_PRICES_MONTHLY: Record<string, number> = {
  free: 0,
  starter: 12,
  pro: 29,
  business: 59,
  enterprise: 149,
};

// Annual billing prices in USD per month (10% off — billed as annual lump sum)
export const TIER_PRICES_ANNUAL: Record<string, number> = {
  free: 0,
  starter: 10.80,
  pro: 26.10,
  business: 53.10,
  enterprise: 134.10,
};
