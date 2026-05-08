"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ScanLine,
  Package,
  Clock,
  CheckCircle2,
  ArrowRight,
  ImageIcon,
  Layers,
  DollarSign,
  Trash2,
  ListChecks,
  TrendingUp,
  ShoppingBag,
  BarChart3,
  Zap,
  Award,
  Target,
} from "lucide-react";
import {
  getAllBatches,
  getBatchSummary,
  deleteBatch,
  updateBatchStatus,
  type Batch,
  type BatchSummary,
  type BatchStatus,
} from "@/lib/supabaseStore";
import { GAME_LABELS, type Game, type ScannedCard } from "@/lib/types";
import { evaluateCard, DEFAULT_DECISION_RULES, type Recommendation } from "@/lib/decisionEngine";
import { useToast } from "@/components/Toast";
import { BatchSkeleton, StatsSkeleton } from "@/components/Skeleton";
import { ScanUsageCard, type ScanUsageProps } from "@/components/ScanUsageCard";
import { createClient } from "@/lib/supabase/client";
import { TIER_LIMITS } from "@/lib/tierLimits";

// ---------------------------------------------------------------------------
// Business metrics computed from batch data
// ---------------------------------------------------------------------------

interface BusinessMetrics {
  // Core KPIs
  totalInventoryValue: number;
  totalListedValue: number;
  profitPotential: number;
  avgCardValue: number;
  // Counts
  totalCards: number;
  totalPhotos: number;
  listedOnEbay: number;
  unlistedCards: number;
  // Pipeline
  pendingBatches: number;
  readyBatches: number;
  listedBatches: number;
  // Breakdowns
  gameBreakdown: { game: string; count: number; value: number }[];
  conditionBreakdown: { condition: string; count: number }[];
  recommendationBreakdown: { rec: string; count: number; label: string }[];
  topCards: { name: string; game: string; value: number; condition: string; listed: boolean }[];
  // Activity
  scannedToday: number;
  scannedThisWeek: number;
  scannedThisMonth: number;
  // New
  gradedCards: number;
  gradedValue: number;
}

function computeMetrics(batches: Batch[]): BusinessMetrics {
  const allCards: ScannedCard[] = batches.flatMap((b) => b.cards);
  const now = Date.now();
  const dayMs = 86_400_000;
  const todayStart = now - (now % dayMs);
  const weekStart = todayStart - 6 * dayMs;
  const monthStart = todayStart - 29 * dayMs;

  let totalInventoryValue = 0;
  let totalListedValue = 0;
  let listedOnEbay = 0;
  let totalPhotos = 0;
  let gradedCards = 0;
  let gradedValue = 0;

  const gameMap = new Map<string, { count: number; value: number }>();
  const condMap = new Map<string, number>();
  const recMap = new Map<Recommendation, number>();

  let scannedToday = 0;
  let scannedThisWeek = 0;
  let scannedThisMonth = 0;

  // Load decision rules from localStorage (same as CardRow)
  let rules = DEFAULT_DECISION_RULES;
  try {
    const saved = typeof window !== "undefined" ? localStorage.getItem("decision_rules") : null;
    if (saved) rules = { ...DEFAULT_DECISION_RULES, ...JSON.parse(saved) };
  } catch { /* ignore */ }

  for (const card of allCards) {
    const val = (card.marketPriceUsd ?? 0) * (card.quantity || 1);
    totalInventoryValue += val;
    totalPhotos += card.photos?.length ?? 0;

    if (card.ebayListingId) {
      listedOnEbay++;
      totalListedValue += val;
    }

    if (card.slabbed) {
      gradedCards++;
      gradedValue += val;
    }

    // Game breakdown
    const gKey = card.game;
    const gEntry = gameMap.get(gKey) || { count: 0, value: 0 };
    gEntry.count += card.quantity || 1;
    gEntry.value += val;
    gameMap.set(gKey, gEntry);

    // Condition breakdown
    condMap.set(card.condition, (condMap.get(card.condition) || 0) + (card.quantity || 1));

    // Recommendation breakdown
    const decision = evaluateCard(card, rules);
    recMap.set(decision.recommendation, (recMap.get(decision.recommendation) || 0) + 1);

    // Activity timeline
    if (card.createdAt >= todayStart) scannedToday++;
    if (card.createdAt >= weekStart) scannedThisWeek++;
    if (card.createdAt >= monthStart) scannedThisMonth++;
  }

  // Pipeline
  let pendingBatches = 0, readyBatches = 0, listedBatches = 0;
  for (const b of batches) {
    if (b.status === "pending") pendingBatches++;
    else if (b.status === "ready") readyBatches++;
    else if (b.status === "listed") listedBatches++;
  }

  // Game breakdown sorted by value desc
  const gameBreakdown = Array.from(gameMap.entries())
    .map(([game, d]) => ({ game: GAME_LABELS[game as Game] || game, count: d.count, value: d.value }))
    .sort((a, b) => b.value - a.value);

  // Condition breakdown sorted by count desc
  const conditionBreakdown = Array.from(condMap.entries())
    .map(([condition, count]) => ({ condition, count }))
    .sort((a, b) => b.count - a.count);

  // Recommendation breakdown
  const REC_LABELS: Record<string, string> = {
    SELL_FAST: "Sell Fast",
    SELL_MAX: "Sell Max",
    GRADE: "Grade",
    HOLD: "Hold",
    BULK_LOT: "Bulk Lot",
  };
  const recommendationBreakdown = Array.from(recMap.entries())
    .map(([rec, count]) => ({ rec, count, label: REC_LABELS[rec] || rec }))
    .sort((a, b) => b.count - a.count);

  // Top cards by value
  const topCards = [...allCards]
    .sort((a, b) => ((b.marketPriceUsd ?? 0) - (a.marketPriceUsd ?? 0)))
    .slice(0, 10)
    .map((c) => ({
      name: c.name,
      game: GAME_LABELS[c.game] || c.game,
      value: c.marketPriceUsd ?? 0,
      condition: c.condition,
      listed: !!c.ebayListingId,
    }));

  const profitPotential = totalInventoryValue - totalListedValue;
  const avgCardValue = allCards.length > 0 ? totalInventoryValue / allCards.length : 0;

  return {
    totalInventoryValue,
    totalListedValue,
    profitPotential,
    avgCardValue,
    totalCards: allCards.length,
    totalPhotos,
    listedOnEbay,
    unlistedCards: allCards.length - listedOnEbay,
    pendingBatches,
    readyBatches,
    listedBatches,
    gameBreakdown,
    conditionBreakdown,
    recommendationBreakdown,
    topCards,
    scannedToday,
    scannedThisWeek,
    scannedThisMonth,
    gradedCards,
    gradedValue,
  };
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [usageData, setUsageData] = useState<ScanUsageProps | null>(null);
  const [wishlistCount, setWishlistCount] = useState<number | null>(null);
  const { toast } = useToast();

  const refresh = async () => {
    try {
      const b = await getAllBatches();
      setBatches(b);
    } catch (err) {
      console.error("Failed to load batches:", err);
      toast("error", "Failed to load batches. Please try refreshing.");
    } finally {
      setLoading(false);
    }
  };

  const loadUsage = async () => {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from("profiles")
        .select("subscription_tier, trial_scans_used, trial_expires_at, credits, rollover_scans")
        .eq("id", user.id)
        .single();

      if (!p) return;

      const tier = p.subscription_tier || "free";
      let scansUsed = p.trial_scans_used || 0;

      // For paid tiers, fetch current period scan count
      if (tier !== "free") {
        const periodStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const { data: usage } = await supabase
          .from("scan_usage")
          .select("scan_count")
          .eq("user_id", user.id)
          .eq("period_start", periodStart.toISOString())
          .single();
        scansUsed = usage?.scan_count || 0;
      }

      setUsageData({
        tier,
        scansUsed,
        trialExpiresAt: p.trial_expires_at,
        credits: p.credits ?? 0,
        rolloverScans: p.rollover_scans ?? 0,
      });
    } catch { /* non-critical */ }
  };

  const loadWishlist = async () => {
    try {
      const res = await fetch("/api/wishlist");
      if (!res.ok) return;
      const data = await res.json();
      const wanted = (data.items ?? []).filter((i: { found: boolean }) => !i.found).length;
      setWishlistCount(wanted);
    } catch { /* non-critical */ }
  };

  useEffect(() => {
    refresh();
    loadUsage();
    loadWishlist();
    const onFocus = () => { refresh(); };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  const metrics = useMemo(() => computeMetrics(batches), [batches]);

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this batch? This can't be undone.")) return;
    try {
      await deleteBatch(id);
      toast("success", "Batch deleted");
      refresh();
    } catch {
      toast("error", "Failed to delete batch");
    }
  };

  const handleStatusToggle = async (id: string, current: BatchStatus) => {
    const next: BatchStatus =
      current === "pending" ? "ready" : current === "ready" ? "listed" : "pending";
    try {
      await updateBatchStatus(id, next);
      toast("success", `Batch marked as ${next}`);
      refresh();
    } catch {
      toast("error", "Failed to update batch status");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted mt-1">
            Business metrics and batch management
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/scan" className="btn-primary">
            <ScanLine className="w-4 h-4" />
            New Scan
          </Link>
        </div>
      </div>

      {/* Scan usage summary */}
      {usageData && (
        <ScanUsageCard
          {...usageData}
          compact={false}
          onUpgrade={() => { window.location.href = "/settings"; }}
        />
      )}

      {loading ? (
        <div className="space-y-3">
          <StatsSkeleton />
          <BatchSkeleton />
          <BatchSkeleton />
        </div>
      ) : (
        <>
          {/* Metrics always visible */}
          <MetricsView metrics={metrics} batches={batches} wishlistCount={wishlistCount} />

          {/* Batch list — shown below metrics when there are batches */}
          {batches.length > 0 && (
            <>
              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-accent" />
                  <h2 className="font-semibold text-sm">Recent Batches</h2>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-accent/10 border-accent/20 text-accent">
                    {batches.length}
                  </span>
                </div>
              </div>
              <BatchesView
                batches={batches}
                onDelete={handleDelete}
                onStatusToggle={handleStatusToggle}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Metrics View
// ---------------------------------------------------------------------------

function MetricsView({ metrics, batches, wishlistCount }: { metrics: BusinessMetrics; batches: Batch[]; wishlistCount: number | null }) {
  if (metrics.totalCards === 0) {
    return (
      <div className="card-panel flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
          <BarChart3 className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-lg font-semibold mb-2">No data yet</h2>
        <p className="text-sm text-muted max-w-md mb-6">
          Scan your first batch of cards to see business metrics, value
          breakdowns, and listing insights here.
        </p>
        <Link href="/scan" className="btn-primary">
          <ScanLine className="w-4 h-4" />
          Start Scanning
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Inventory Value"
          value={`$${metrics.totalInventoryValue.toFixed(2)}`}
          icon={DollarSign}
          accent
        />
        <KpiCard
          label="Listed Value"
          value={`$${metrics.totalListedValue.toFixed(2)}`}
          icon={ShoppingBag}
          sub={metrics.listedOnEbay > 0 ? `${metrics.listedOnEbay} on eBay` : undefined}
        />
        <KpiCard
          label="Graded Slabs"
          value={metrics.gradedCards > 0 ? String(metrics.gradedCards) : "—"}
          icon={Award}
          sub={metrics.gradedValue > 0 ? `$${metrics.gradedValue.toFixed(0)} value` : undefined}
          href="/collection"
        />
        <KpiCard
          label="Wanted"
          value={wishlistCount != null ? String(wishlistCount) : "—"}
          icon={Target}
          sub={wishlistCount === 0 ? "Nothing on wishlist" : wishlistCount === 1 ? "1 card to find" : `${wishlistCount} cards to find`}
          accent={!!wishlistCount && wishlistCount > 0}
          href="/collection?tab=wishlist"
        />
      </div>

      {/* Activity + Pipeline row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Scan Activity */}
        <div className="card-panel">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm">Scan Activity</h3>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <ActivityStat label="Today" value={metrics.scannedToday} />
            <ActivityStat label="This Week" value={metrics.scannedThisWeek} />
            <ActivityStat label="This Month" value={metrics.scannedThisMonth} />
          </div>
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-border text-xs text-muted">
            <span className="inline-flex items-center gap-1">
              <Layers className="w-3 h-3" /> {metrics.totalCards} total cards
            </span>
            <span className="inline-flex items-center gap-1">
              <ImageIcon className="w-3 h-3" /> {metrics.totalPhotos} photos
            </span>
            <span className="inline-flex items-center gap-1">
              <Package className="w-3 h-3" /> {batches.length} batches
            </span>
          </div>
        </div>

        {/* Batch Pipeline */}
        <div className="card-panel">
          <div className="flex items-center gap-2 mb-4">
            <ListChecks className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm">Batch Pipeline</h3>
          </div>
          <div className="space-y-3">
            <PipelineRow label="Pending Review" count={metrics.pendingBatches} total={batches.length} color="bg-yellow-400" />
            <PipelineRow label="Ready to List" count={metrics.readyBatches} total={batches.length} color="bg-accent" />
            <PipelineRow label="Listed" count={metrics.listedBatches} total={batches.length} color="bg-accent2" />
          </div>
        </div>
      </div>

      {/* Breakdowns row */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Game Breakdown */}
        {metrics.gameBreakdown.length > 0 && (
          <div className="card-panel">
            <h3 className="font-semibold text-sm mb-3">By Game</h3>
            <div className="space-y-2">
              {metrics.gameBreakdown.map((g) => (
                <div key={g.game} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{g.game}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted">{g.count} cards</span>
                    <span className="font-medium">${g.value.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Condition Breakdown */}
        {metrics.conditionBreakdown.length > 0 && (
          <div className="card-panel">
            <h3 className="font-semibold text-sm mb-3">By Condition</h3>
            <div className="space-y-2">
              {metrics.conditionBreakdown.map((c) => (
                <div key={c.condition} className="flex items-center justify-between text-sm">
                  <span className="text-muted">{c.condition}</span>
                  <span className="font-medium">{c.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AI Recommendations Breakdown */}
        {metrics.recommendationBreakdown.length > 0 && (
          <div className="card-panel">
            <h3 className="font-semibold text-sm mb-3">AI Recommendations</h3>
            <div className="space-y-2">
              {metrics.recommendationBreakdown.map((r) => {
                const colors: Record<string, string> = {
                  SELL_FAST: "text-emerald-400",
                  SELL_MAX: "text-blue-400",
                  GRADE: "text-purple-400",
                  HOLD: "text-yellow-400",
                  BULK_LOT: "text-gray-400",
                };
                return (
                  <div key={r.rec} className="flex items-center justify-between text-sm">
                    <span className={colors[r.rec] || "text-muted"}>{r.label}</span>
                    <span className="font-medium">{r.count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Top Cards */}
      {metrics.topCards.length > 0 && (
        <div className="card-panel">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm">Top Cards by Value</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted border-b border-border">
                  <th className="pb-2 pr-4">#</th>
                  <th className="pb-2 pr-4">Card</th>
                  <th className="pb-2 pr-4">Game</th>
                  <th className="pb-2 pr-4">Condition</th>
                  <th className="pb-2 pr-4 text-right">Value</th>
                  <th className="pb-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {metrics.topCards.map((card, i) => (
                  <tr key={`${card.name}-${i}`} className="border-b border-border/50 last:border-0">
                    <td className="py-2 pr-4 text-muted">{i + 1}</td>
                    <td className="py-2 pr-4 font-medium truncate max-w-[200px]">{card.name}</td>
                    <td className="py-2 pr-4 text-muted">{card.game}</td>
                    <td className="py-2 pr-4 text-muted">{card.condition}</td>
                    <td className="py-2 pr-4 text-right font-medium">${card.value.toFixed(2)}</td>
                    <td className="py-2 text-right">
                      {card.listed ? (
                        <span className="inline-flex items-center gap-1 text-xs text-accent2">
                          <CheckCircle2 className="w-3 h-3" /> Listed
                        </span>
                      ) : (
                        <span className="text-xs text-muted">Unlisted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Batches View (moved from old dashboard)
// ---------------------------------------------------------------------------

function BatchesView({
  batches,
  onDelete,
  onStatusToggle,
}: {
  batches: Batch[];
  onDelete: (id: string) => void;
  onStatusToggle: (id: string, current: BatchStatus) => void;
}) {
  if (batches.length === 0) {
    return (
      <div className="card-panel flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
          <Package className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-lg font-semibold mb-2">No batches yet</h2>
        <p className="text-sm text-muted max-w-md mb-6">
          Scan your first batch of cards to get started. Upload photos or use the
          live camera — identified cards will appear here as a batch ready for
          review and listing.
        </p>
        <Link href="/scan" className="btn-primary">
          <ScanLine className="w-4 h-4" />
          Start Scanning
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map((batch) => {
        const cardCount = batch.cards.length;
        const photoCount = batch.cards.reduce((s, c) => s + (c.photos?.length ?? 0), 0);
        const value = batch.cards.reduce((s, c) => s + (c.marketPriceUsd ?? 0) * (c.quantity || 1), 0);
        const ebayCount = batch.cards.filter((c) => c.ebayListingId).length;
        const dateStr = new Date(batch.updatedAt).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        });

        return (
          <div
            key={batch.id}
            className="card-panel flex items-center gap-4 hover:border-accent/30 transition-colors group"
          >
            <Link
              href={`/scan?batch=${batch.id}`}
              className="flex items-center gap-4 flex-1 min-w-0"
            >
              <div className="w-12 h-12 rounded-xl bg-panel2 border border-border flex items-center justify-center shrink-0">
                <Package className="w-6 h-6 text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold truncate">{batch.name}</span>
                  <StatusBadge status={batch.status} />
                  {ebayCount > 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border bg-accent2/10 border-accent2/30 text-accent2">
                      <ShoppingBag className="w-3 h-3" />
                      {ebayCount} on eBay
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Layers className="w-3 h-3" />
                    {cardCount} card{cardCount !== 1 ? "s" : ""}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <ImageIcon className="w-3 h-3" />
                    {photoCount} photo{photoCount !== 1 ? "s" : ""}
                  </span>
                  <span>${value.toFixed(2)}</span>
                  <span>{dateStr}</span>
                </div>
              </div>
              <ArrowRight className="w-4 h-4 text-muted shrink-0" />
            </Link>

            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
              <button
                onClick={() => onStatusToggle(batch.id, batch.status)}
                className="p-2 rounded-lg text-muted hover:text-accent hover:bg-panel2 transition-colors"
                title={`Mark as ${batch.status === "pending" ? "ready" : batch.status === "ready" ? "listed" : "pending"}`}
              >
                <ListChecks className="w-4 h-4" />
              </button>
              <button
                onClick={() => onDelete(batch.id)}
                className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                title="Delete batch"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon: Icon,
  accent,
  sub,
  href,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{ className?: string }>;
  accent?: boolean;
  sub?: string;
  href?: string;
}) {
  const inner = (
    <div className={`card-panel flex items-center gap-3 py-4 ${href ? "hover:border-accent/40 transition-colors cursor-pointer" : ""}`}>
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
          accent
            ? "bg-accent/15 border border-accent/30"
            : "bg-panel2 border border-border"
        }`}
      >
        <Icon className={`w-5 h-5 ${accent ? "text-accent" : "text-muted"}`} />
      </div>
      <div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-[11px] text-muted uppercase tracking-wider">{label}</div>
        {sub && <div className="text-[10px] text-muted mt-0.5">{sub}</div>}
      </div>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function ActivityStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-[10px] text-muted uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function PipelineRow({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1">
        <span className="text-muted">{label}</span>
        <span className="font-medium">{count}</span>
      </div>
      <div className="w-full h-2 rounded-full bg-panel2 border border-border overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: BatchStatus }) {
  const styles = {
    pending: "bg-yellow-500/10 border-yellow-500/30 text-yellow-400",
    ready: "bg-accent/10 border-accent/30 text-accent",
    listed: "bg-accent2/10 border-accent2/30 text-accent2",
  };
  const labels = { pending: "Pending", ready: "Ready", listed: "Listed" };
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}
