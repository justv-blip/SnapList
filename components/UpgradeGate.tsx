"use client";

/**
 * UpgradeGate — contextual upsell banner shown at the top of Pro/Business-gated pages.
 *
 * Usage:
 *   <UpgradeGate requiredTier="pro" currentTier={tier} featureName="Trade Analyzer" />
 *
 * Renders nothing if the user already has the required tier or higher.
 */

import Link from "next/link";
import { Zap, ArrowRight } from "lucide-react";

type Tier = "free" | "starter" | "pro" | "business" | "enterprise" | "team" | "agency";

const TIER_RANK: Record<Tier, number> = {
  free: 0,
  starter: 1,
  pro: 2,
  business: 3,
  enterprise: 4,
  team: 5,
  agency: 6,
};

const TIER_LABELS: Record<Tier, string> = {
  free: "Free",
  starter: "Lister",
  pro: "Pro",
  business: "Business",
  enterprise: "Enterprise",
  team: "Team",
  agency: "Agency",
};

interface Props {
  requiredTier: Tier;
  currentTier: string;
  featureName: string;
  description?: string;
}

export function UpgradeGate({ requiredTier, currentTier, featureName, description }: Props) {
  const userRank = TIER_RANK[(currentTier as Tier) ?? "free"] ?? 0;
  const requiredRank = TIER_RANK[requiredTier];

  // Already has access — render nothing
  if (userRank >= requiredRank) return null;

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/[0.05] p-5 flex flex-col sm:flex-row sm:items-center gap-4">
      <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
        <Zap className="w-5 h-5 text-accent" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm">
          {featureName} requires the <span className="text-accent">{TIER_LABELS[requiredTier]}</span> plan
        </p>
        <p className="text-xs text-muted mt-0.5">
          {description ?? `Upgrade to unlock ${featureName} and all ${TIER_LABELS[requiredTier]} features.`}
        </p>
      </div>
      <Link
        href="/settings"
        className="btn-primary shrink-0 inline-flex items-center gap-2 text-sm whitespace-nowrap"
      >
        Upgrade to {TIER_LABELS[requiredTier]}
        <ArrowRight className="w-4 h-4" />
      </Link>
    </div>
  );
}
