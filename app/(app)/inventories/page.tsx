"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Warehouse,
  Search,
  RefreshCcw,
  ExternalLink,
  Package,
  DollarSign,
  AlertCircle,
  CheckCircle2,
  Clock,
  Layers,
  ShoppingCart,
  AlertTriangle,
  Trash2,
  XCircle,
  History,
  ChevronDown,
  ChevronRight,
  Loader2,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  getInventorySnapshot,
  recordSale,
  recordDelist,
  removeInventoryItem,
  getRecentEvents,
  type InventoryItem,
  type InventorySnapshot,
  type InventoryStatus,
  type SyncEvent,
  type QuantityConflict,
} from "@/lib/supabaseInventoryStore";
import type { ExportPlatform } from "@/lib/types";

type Platform = ExportPlatform;
type ListingStatus = InventoryStatus;

const PLATFORM_META: Record<string, { label: string; color: string; bg: string }> = {
  ebay: { label: "eBay", color: "text-[#e53238]", bg: "bg-[#e53238]/10" },
  tcgplayer: { label: "TCGPlayer", color: "text-[#3b82f6]", bg: "bg-[#3b82f6]/10" },
  shopify: { label: "Shopify", color: "text-[#96bf48]", bg: "bg-[#96bf48]/10" },
  whatnot: { label: "Whatnot", color: "text-[#7c3aed]", bg: "bg-[#7c3aed]/10" },
  squarespace: { label: "Squarespace", color: "text-[#111]", bg: "bg-gray-500/10" },
  generic: { label: "CSV Export", color: "text-muted", bg: "bg-panel2" },
};

const STATUS_META: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  active: { label: "Active", icon: CheckCircle2, color: "text-accent2" },
  sold: { label: "Sold", icon: DollarSign, color: "text-accent" },
  ended: { label: "Ended", icon: AlertCircle, color: "text-muted" },
  delisted: { label: "Delisted", icon: XCircle, color: "text-muted" },
  draft: { label: "Draft", icon: Clock, color: "text-muted" },
  error: { label: "Error", icon: AlertCircle, color: "text-danger" },
};

export default function InventoriesPage() {
  const [snapshot, setSnapshot] = useState<InventorySnapshot | null>(null);
  const [events, setEvents] = useState<SyncEvent[]>([]);
  const [platformFilter, setPlatformFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showEvents, setShowEvents] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Sync state
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ synced: number; sold: number; ended: number; repriced: number; errors: string[] } | null>(null);
  const [syncStatus, setSyncStatus] = useState<{ lastPollAt: number | null; lastWebhookAt: number | null; webhookHealthy: boolean; totalEventsProcessed: number } | null>(null);

  const refresh = useCallback(async () => {
    const [snap, evts] = await Promise.all([
      getInventorySnapshot(),
      getRecentEvents(30),
    ]);
    setSnapshot(snap);
    setEvents(evts);
  }, []);

  // Fetch sync status from server
  const fetchSyncStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/ebay/sync");
      if (res.ok) {
        const data = await res.json();
        setSyncStatus(data.status || null);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { refresh(); fetchSyncStatus(); }, [refresh, fetchSyncStatus]);

  const triggerSync = async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/ebay/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        setSyncResult(data.result);
        refresh();
        fetchSyncStatus();
      } else {
        setSyncResult({ synced: 0, sold: 0, ended: 0, repriced: 0, errors: [data.error || "Sync failed"] });
      }
    } catch {
      setSyncResult({ synced: 0, sold: 0, ended: 0, repriced: 0, errors: ["Network error"] });
    } finally {
      setSyncing(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Flatten inventory items into a displayable list with platform listing rows
  const displayItems = useMemo(() => {
    if (!snapshot) return [];
    return snapshot.items.filter((item) => {
      if (searchQuery && !item.cardName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (platformFilter !== "all") {
        const hasListing = item.listings.some((l) => l.platform === platformFilter);
        if (!hasListing) return false;
      }
      if (statusFilter !== "all") {
        const hasStatus = item.listings.some((l) => l.status === statusFilter);
        if (!hasStatus) return false;
      }
      return true;
    });
  }, [snapshot, platformFilter, statusFilter, searchQuery]);

  const handleMarkSold = async (cardId: string, platform: ExportPlatform, listingId: string) => {
    await recordSale(cardId, platform, listingId);
    await refresh();
  };

  const handleDelist = async (cardId: string, platform: ExportPlatform, listingId: string) => {
    await recordDelist(cardId, platform, listingId);
    await refresh();
  };

  const handleRemove = async (cardId: string) => {
    await removeInventoryItem(cardId);
    await refresh();
  };

  const stats = snapshot
    ? {
        totalCards: snapshot.totalCards,
        activeListings: snapshot.activeListings,
        totalListedValue: snapshot.totalListedValue,
        totalSoldValue: snapshot.totalSoldValue,
        conflicts: snapshot.conflicts.length,
      }
    : { totalCards: 0, activeListings: 0, totalListedValue: 0, totalSoldValue: 0, conflicts: 0 };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Inventories</h1>
          <p className="text-sm text-muted mt-1">
            Track listings across platforms — quantities, sync status, and sales
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn text-xs" onClick={() => setShowEvents(!showEvents)}>
            <History className="w-3.5 h-3.5" />
            Activity
          </button>
          <button className="btn text-xs" onClick={refresh}>
            <RefreshCcw className="w-3.5 h-3.5" />
            Refresh
          </button>
          <button
            className="btn-primary text-xs"
            onClick={triggerSync}
            disabled={syncing}
            title="Pull latest status from eBay"
          >
            {syncing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            {syncing ? "Syncing…" : "Sync Now"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard icon={Layers} label="Tracked Cards" value={String(stats.totalCards)} />
        <StatCard icon={CheckCircle2} label="Active Listings" value={String(stats.activeListings)} color="text-accent2" />
        <StatCard icon={DollarSign} label="Listed Value" value={`$${stats.totalListedValue.toFixed(2)}`} />
        <StatCard icon={ShoppingCart} label="Revenue" value={`$${stats.totalSoldValue.toFixed(2)}`} color="text-accent" />
        <StatCard
          icon={stats.conflicts > 0 ? AlertTriangle : CheckCircle2}
          label="Conflicts"
          value={String(stats.conflicts)}
          color={stats.conflicts > 0 ? "text-danger" : "text-accent2"}
        />
      </div>

      {/* Sync status bar */}
      <div className="card-panel flex items-center justify-between py-3 px-4">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            {syncStatus?.webhookHealthy ? (
              <Wifi className="w-3.5 h-3.5 text-accent2" />
            ) : (
              <WifiOff className="w-3.5 h-3.5 text-muted" />
            )}
            <span className={syncStatus?.webhookHealthy ? "text-accent2" : "text-muted"}>
              Webhooks {syncStatus?.webhookHealthy ? "connected" : "inactive"}
            </span>
          </div>
          {syncStatus?.lastPollAt && (
            <span className="text-muted">
              Last sync: {formatTimeAgo(syncStatus.lastPollAt)}
            </span>
          )}
          {syncStatus?.lastWebhookAt && (
            <span className="text-muted">
              Last event: {formatTimeAgo(syncStatus.lastWebhookAt)}
            </span>
          )}
          {syncStatus && syncStatus.totalEventsProcessed > 0 && (
            <span className="text-muted">
              {syncStatus.totalEventsProcessed} events processed
            </span>
          )}
        </div>
      </div>

      {/* Sync result banner */}
      {syncResult && (
        <div className={`card-panel py-3 px-4 ${syncResult.errors.length > 0 ? "bg-danger/5 border-danger/20" : "bg-accent2/5 border-accent2/20"}`}>
          <div className="flex items-center gap-3 text-sm">
            {syncResult.errors.length > 0 ? (
              <AlertTriangle className="w-4 h-4 text-danger shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-accent2 shrink-0" />
            )}
            <span>
              Sync complete — {syncResult.synced} listings checked
              {syncResult.sold > 0 && `, ${syncResult.sold} sold`}
              {syncResult.ended > 0 && `, ${syncResult.ended} ended`}
              {syncResult.repriced > 0 && `, ${syncResult.repriced} repriced`}
              {syncResult.errors.length > 0 && `. Errors: ${syncResult.errors.join(", ")}`}
            </span>
            <button className="ml-auto text-muted hover:text-white" onClick={() => setSyncResult(null)}>
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Quantity conflict alerts */}
      {snapshot && snapshot.conflicts.length > 0 && (
        <div className="space-y-2">
          {snapshot.conflicts.map((conflict) => (
            <div
              key={conflict.cardId}
              className="card-panel bg-danger/5 border-danger/20 flex items-start gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-danger shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  Oversold: {conflict.cardName}
                  {conflict.sku && <span className="text-muted ml-2">SKU: {conflict.sku}</span>}
                </p>
                <p className="text-xs text-muted mt-0.5">
                  {conflict.totalQuantity} in stock but {conflict.listedQuantity} listed
                  across {conflict.platforms.length} platform{conflict.platforms.length !== 1 ? "s" : ""}
                  ({conflict.platforms.map((p) => `${PLATFORM_META[p.platform]?.label || p.platform}: ${p.quantity}`).join(", ")}).
                  Deficit: {conflict.deficit}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Activity log */}
      {showEvents && (
        <div className="card-panel">
          <h2 className="font-semibold mb-3">Recent Activity</h2>
          {events.length === 0 ? (
            <p className="text-sm text-muted">No sync activity yet</p>
          ) : (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {events.map((event) => (
                <div key={event.id} className="flex items-start gap-3 text-xs">
                  <span className="text-muted shrink-0 w-28">
                    {new Date(event.timestamp).toLocaleString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit"
                    })}
                  </span>
                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    event.type === "sold" ? "bg-accent/10 text-accent" :
                    event.type === "listed" ? "bg-accent2/10 text-accent2" :
                    event.type === "delisted" ? "bg-danger/10 text-danger" :
                    "bg-panel2 text-muted"
                  }`}>
                    {event.type}
                  </span>
                  <span className="text-muted">{event.details}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Platform connections */}
      <div className="card-panel">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Connected Platforms</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(["ebay", "tcgplayer", "shopify", "whatnot"] as const).map((key) => {
            const meta = PLATFORM_META[key];
            const platformListings = snapshot?.items.reduce(
              (count, item) => count + item.listings.filter((l) => l.platform === key && l.status === "active").length,
              0
            ) ?? 0;
            return (
              <div
                key={key}
                className="flex items-center gap-3 p-3 rounded-lg bg-panel2 border border-border"
              >
                <div className={`w-9 h-9 rounded-lg ${meta.bg} flex items-center justify-center shrink-0`}>
                  <Package className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{meta.label}</p>
                  <p className="text-[10px] text-muted">
                    {platformListings > 0
                      ? `${platformListings} active listing${platformListings !== 1 ? "s" : ""}`
                      : "Not connected"}
                  </p>
                </div>
                <button className="text-xs text-accent hover:underline">
                  {platformListings > 0 ? "Sync" : "Connect"}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            className="input pl-9 w-full"
            placeholder="Search inventory..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <select
          className="input text-sm min-w-[130px]"
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value)}
        >
          <option value="all">All Platforms</option>
          {(["ebay", "tcgplayer", "shopify", "whatnot"] as const).map((key) => (
            <option key={key} value={key}>{PLATFORM_META[key].label}</option>
          ))}
        </select>
        <select
          className="input text-sm min-w-[120px]"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="all">All Status</option>
          {(["active", "sold", "delisted", "draft"] as const).map((key) => (
            <option key={key} value={key}>{STATUS_META[key].label}</option>
          ))}
        </select>
      </div>

      {/* Inventory list */}
      {displayItems.length === 0 ? (
        <div className="card-panel text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-panel2 border border-border flex items-center justify-center mx-auto mb-4">
            <Warehouse className="w-8 h-8 text-muted" />
          </div>
          <h3 className="font-semibold mb-1">
            {snapshot && snapshot.totalCards > 0 ? "No matching items" : "No inventory tracked yet"}
          </h3>
          <p className="text-sm text-muted max-w-sm mx-auto leading-relaxed">
            {snapshot && snapshot.totalCards > 0
              ? "Try changing your filters or search query."
              : "When you export or push listings from the Scanner, they'll appear here for tracking. You can mark items as sold, delist them, and monitor cross-platform quantities."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayItems.map((item) => (
            <InventoryItemRow
              key={item.cardId}
              item={item}
              expanded={expandedItems.has(item.cardId)}
              onToggle={() => toggleExpand(item.cardId)}
              onMarkSold={handleMarkSold}
              onDelist={handleDelist}
              onRemove={handleRemove}
            />
          ))}
        </div>
      )}

      {/* Tips */}
      <div className="card-panel">
        <div className="flex items-center gap-2 mb-2">
          <AlertCircle className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Inventory Tips</h3>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Inventory is tracked automatically when you export or push listings from the Scanner.
          Mark items as sold when they sell to keep quantities accurate. If a card is listed on
          multiple platforms, watch for quantity conflicts — you&apos;ll see an alert if more
          are listed than you have in stock.
        </p>
      </div>
    </div>
  );
}

// ---- Inventory item row ----

function InventoryItemRow({
  item,
  expanded,
  onToggle,
  onMarkSold,
  onDelist,
  onRemove,
}: {
  item: InventoryItem;
  expanded: boolean;
  onToggle: () => void;
  onMarkSold: (cardId: string, platform: ExportPlatform, listingId: string) => void;
  onDelist: (cardId: string, platform: ExportPlatform, listingId: string) => void;
  onRemove: (cardId: string) => void;
}) {
  const activeListings = item.listings.filter((l) => l.status === "active");
  const hasConflict = item.availableQuantity < 0;

  return (
    <div className={`card-panel ${hasConflict ? "border-danger/30" : ""}`}>
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 text-left"
      >
        {expanded ? (
          <ChevronDown className="w-4 h-4 text-muted shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 text-muted shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{item.cardName}</p>
          <p className="text-[10px] text-muted">
            {item.game} {item.setName ? `• ${item.setName}` : ""}
            {item.sku ? ` • SKU: ${item.sku}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          {/* Quantity summary */}
          <div className="text-right">
            <p className="text-xs font-medium">
              {item.totalQuantity} in stock
            </p>
            <p className={`text-[10px] ${hasConflict ? "text-danger font-medium" : "text-muted"}`}>
              {item.listedQuantity} listed
              {hasConflict && ` (${Math.abs(item.availableQuantity)} over)`}
            </p>
          </div>
          {/* Platform badges */}
          <div className="flex gap-1">
            {activeListings.map((l) => {
              const meta = PLATFORM_META[l.platform];
              return (
                <span
                  key={`${l.platform}-${l.listingId}`}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${meta?.bg || "bg-panel2"} ${meta?.color || "text-muted"}`}
                >
                  {meta?.label || l.platform}
                </span>
              );
            })}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="mt-4 pt-4 border-t border-border space-y-2">
          {item.listings.length === 0 ? (
            <p className="text-xs text-muted">No listings tracked</p>
          ) : (
            item.listings.map((listing) => {
              const meta = PLATFORM_META[listing.platform];
              const statusMeta = STATUS_META[listing.status] || STATUS_META.draft;
              const StatusIcon = statusMeta.icon;
              return (
                <div
                  key={`${listing.platform}-${listing.listingId}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-panel2 border border-border"
                >
                  <div className={`w-8 h-8 rounded-lg ${meta?.bg || "bg-panel2"} flex items-center justify-center shrink-0`}>
                    <Package className={`w-4 h-4 ${meta?.color || "text-muted"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{meta?.label || listing.platform}</span>
                      <span className={`inline-flex items-center gap-1 text-[10px] ${statusMeta.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {statusMeta.label}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted">
                      ${listing.listPrice.toFixed(2)} • qty {listing.quantity}
                      {listing.listingId ? ` • ID: ${listing.listingId}` : ""}
                      {" • "}
                      {new Date(listing.listedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {listing.listingUrl && (
                      <a
                        href={listing.listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn text-xs px-2 py-1"
                        title="View listing"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                    {listing.status === "active" && (
                      <>
                        <button
                          className="btn text-xs px-2 py-1"
                          onClick={() => onMarkSold(item.cardId, listing.platform, listing.listingId)}
                          title="Mark as sold"
                        >
                          <DollarSign className="w-3 h-3" />
                          Sold
                        </button>
                        <button
                          className="btn text-xs px-2 py-1"
                          onClick={() => onDelist(item.cardId, listing.platform, listing.listingId)}
                          title="Delist"
                        >
                          <XCircle className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div className="flex justify-end pt-2">
            <button
              className="text-xs text-danger hover:underline flex items-center gap-1"
              onClick={() => onRemove(item.cardId)}
            >
              <Trash2 className="w-3 h-3" />
              Remove from inventory
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Time ago helper ----

function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---- Stat card ----

function StatCard({
  icon: Icon,
  label,
  value,
  color = "text-foreground",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="card-panel flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-panel2 border border-border flex items-center justify-center shrink-0">
        <Icon className="w-5 h-5 text-muted" />
      </div>
      <div>
        <p className="text-[10px] text-muted uppercase tracking-wider font-medium">{label}</p>
        <p className={`text-lg font-bold ${color}`}>{value}</p>
      </div>
    </div>
  );
}
