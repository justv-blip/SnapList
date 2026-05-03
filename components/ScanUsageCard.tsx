"use client";

import { useEffect, useRef } from "react";
import { ScanLine, ArrowRight, Zap, Clock } from "lucide-react";
import { TIER_LIMITS, TIER_LABELS } from "@/lib/tierLimits";

export interface ScanUsageProps {
  tier: string;
  scansUsed: number;
  trialExpiresAt?: string | null;
  onUpgrade?: () => void;
  /** If true, renders a compact single-row variant */
  compact?: boolean;
  /** Bonus credits earned (shown as "+ X bonus scans") */
  credits?: number;
}

const TIER_BADGE: Record<string, string> = {
  free:       "bg-muted/20      text-muted       border-muted/30",
  starter:    "bg-accent/15     text-accent      border-accent/30",
  pro:        "bg-purple-500/15 text-purple-400  border-purple-500/30",
  business:   "bg-orange-500/15 text-orange-400  border-orange-500/30",
  enterprise: "bg-amber-500/15  text-amber-400   border-amber-500/30",
};

const TIER_BAR: Record<string, string> = {
  free:       "bg-muted",
  starter:    "bg-accent",
  pro:        "bg-purple-400",
  business:   "bg-orange-400",
  enterprise: "bg-amber-400",
};

/**
 * Animated arc (SVG) showing scan usage as a semicircle gauge.
 */
function UsageArc({ pct, tier }: { pct: number; tier: string }) {
  const r = 36;
  const cx = 44;
  const cy = 44;
  const circumference = Math.PI * r; // half circle
  const offset = circumference * (1 - Math.min(pct / 100, 1));

  // Color mapped to pct
  const arcColor =
    pct >= 90 ? "#f87171" :
    pct >= 70 ? "#f0c45a" :
    tier === "enterprise" ? "#f59e0b" :
    tier === "business"   ? "#fb923c" :
    tier === "pro"        ? "#a78bfa" :
    "#7c9cff";

  return (
    <svg width="88" height="52" viewBox="0 0 88 52" className="overflow-visible">
      {/* Track */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke="#243049"
        strokeWidth="7"
        strokeLinecap="round"
      />
      {/* Fill */}
      <path
        d={`M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        fill="none"
        stroke={arcColor}
        strokeWidth="7"
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(0.4,0,0.2,1)" }}
      />
    </svg>
  );
}

export function ScanUsageCard({
  tier,
  scansUsed,
  trialExpiresAt,
  onUpgrade,
  compact = false,
  credits = 0,
}: ScanUsageProps) {
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const pct = Math.min(100, Math.round((scansUsed / limit) * 100));
  const remaining = Math.max(0, limit - scansUsed);
  const tierLabel = TIER_LABELS[tier] || tier;
  const isFree = tier === "free";
  const isEnterprise = tier === "enterprise";
  const isNearLimit = pct >= 80 && !isEnterprise;

  // Trial countdown
  let daysLeft: number | null = null;
  if (trialExpiresAt) {
    const diff = new Date(trialExpiresAt).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diff / 86_400_000));
  }

  // ── Compact single-row variant (for header/banner use) ──
  if (compact) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl border border-border bg-panel2 text-sm">
        <ScanLine className="w-4 h-4 text-accent shrink-0" />
        <span className="text-muted text-xs">
          {isEnterprise ? (
            <span className="text-accent2 font-medium">Unlimited scans</span>
          ) : (
            <>
              <span className="font-semibold text-foreground">{remaining.toLocaleString()}</span>
              <span className="text-muted"> / {limit.toLocaleString()} scans</span>
            </>
          )}
        </span>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${
            TIER_BADGE[tier] || TIER_BADGE.free
          }`}
        >
          {tierLabel}
        </span>
        {isFree && onUpgrade && (
          <button
            onClick={onUpgrade}
            className="ml-auto text-xs text-accent hover:underline font-medium shrink-0 flex items-center gap-1"
          >
            Upgrade <ArrowRight className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  // ── Full card variant ──
  return (
    <div
      className={`card-panel ${
        isNearLimit ? "border-yellow-500/30 bg-yellow-500/[0.02]" : ""
      }`}
    >
      <div className="flex flex-col sm:flex-row sm:items-center gap-6">

        {/* Arc gauge */}
        <div className="flex flex-col items-center shrink-0 relative">
          <UsageArc pct={isEnterprise ? 15 : pct} tier={tier} />
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center pb-1">
            <div className="text-xl font-bold leading-none">
              {isEnterprise ? "∞" : `${pct}%`}
            </div>
            <div className="text-[9px] text-muted uppercase tracking-wider mt-0.5">used</div>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <span className="font-semibold text-sm">Scan Usage</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wide ${
                TIER_BADGE[tier] || TIER_BADGE.free
              }`}
            >
              {tierLabel}
            </span>
            {isNearLimit && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-yellow-500/10 border-yellow-500/30 text-yellow-400">
                <Zap className="w-2.5 h-2.5" /> Near limit
              </span>
            )}
          </div>

          {isEnterprise ? (
            <p className="text-sm text-muted">
              <span className="text-accent2 font-medium">Unlimited scans</span> — no monthly cap on your plan.
            </p>
          ) : (
            <>
              {/* Usage bar */}
              <div className="w-full h-1.5 rounded-full bg-panel2 border border-border overflow-hidden mb-2">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    pct >= 90 ? "bg-danger" : pct >= 70 ? "bg-yellow-400" : TIER_BAR[tier] || "bg-accent"
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className="text-xs text-muted">
                <span className="font-semibold text-foreground">{scansUsed.toLocaleString()}</span>
                {" "}of{" "}
                <span className="font-semibold text-foreground">{limit.toLocaleString()}</span>
                {" "}scans used this month
                {remaining > 0 && (
                  <> &middot; <span className="text-foreground font-medium">{remaining.toLocaleString()} remaining</span></>
                )}
              </p>
              {credits > 0 && (
                <p className="text-xs text-accent2 mt-1">
                  + <span className="font-semibold">{credits.toLocaleString()}</span> bonus scan{credits !== 1 ? "s" : ""} from credits
                </p>
              )}
            </>
          )}

          {/* Trial countdown */}
          {isFree && daysLeft !== null && (
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              <Clock className="w-3.5 h-3.5 text-muted" />
              <span className="text-muted">
                Free trial:{" "}
                {daysLeft === 0 ? (
                  <span className="text-danger font-medium">Expires today</span>
                ) : (
                  <span className="text-foreground font-medium">{daysLeft} day{daysLeft !== 1 ? "s" : ""} remaining</span>
                )}
              </span>
            </div>
          )}
        </div>

        {/* Upgrade CTA */}
        {(isFree || isNearLimit) && onUpgrade && (
          <div className="shrink-0">
            <button
              onClick={onUpgrade}
              className="btn-primary text-xs px-4 py-2"
            >
              {isFree ? "Upgrade plan" : "Increase limit"}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
