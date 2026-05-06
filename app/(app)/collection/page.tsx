"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Library,
  Search,
  Filter,
  Grid3X3,
  List,
  ScanLine,
  ArrowRight,
  X,
  ChevronDown,
  ArrowUpDown,
  ImageIcon,
  ExternalLink,
  Award,
  ShieldCheck,
  Copy,
  Package,
  CreditCard,
  Globe,
  Tag,
  TrendingUp,
  AlertCircle,
  Trash2,
} from "lucide-react";
import { getAllBatches, type Batch } from "@/lib/supabaseStore";
import type { ScannedCard, Game, Condition, SealedCondition } from "@/lib/types";
import { GAME_LABELS, CONDITIONS, GRADING_COMPANY_LABELS, SEALED_PRODUCT_LABELS, SEALED_CONDITION_LABELS } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { BatchSkeleton } from "@/components/Skeleton";
import { detectDuplicates, type DuplicateGroup } from "@/lib/duplicates";

// ── Types ──

type CollectionTab = "cards" | "sealed";
type ViewMode = "grid" | "list" | "duplicates";
type SortField = "name" | "price" | "date" | "game";
type SortDir = "asc" | "desc";

interface CardWithBatch extends ScannedCard {
  batchId: string;
  batchName: string;
}

interface SealedItem {
  id: string;
  product_name: string | null;
  game: string | null;
  product_type: string | null;
  set_name: string | null;
  language: string | null;
  edition: string | null;
  confidence: number;
  reasoning: string | null;
  market_price_usd: number | null;
  price_source: string | null;
  price_sample_size: number | null;
  condition: SealedCondition;
  notes: string | null;
  created_at: string;
}

// ── Component ──

export default function CollectionPage() {
  const [tab, setTab] = useState<CollectionTab>("cards");

  // Cards state
  const [batches, setBatches] = useState<Batch[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [view, setView] = useState<ViewMode>("grid");

  // Sealed state
  const [sealedItems, setSealedItems] = useState<SealedItem[]>([]);
  const [sealedLoading, setSealedLoading] = useState(true);
  const [sealedQuery, setSealedQuery] = useState("");
  const [sealedFilterGame, setSealedFilterGame] = useState("");
  const [sealedFilterCondition, setSealedFilterCondition] = useState<SealedCondition | "">("");

  // Cards search & filters
  const [query, setQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterGame, setFilterGame] = useState<Game | "">("");
  const [filterCondition, setFilterCondition] = useState<Condition | "">("");
  const [filterBatch, setFilterBatch] = useState("");
  const [filterFoil, setFilterFoil] = useState<"" | "yes" | "no">("");
  const [filterGraded, setFilterGraded] = useState<"" | "yes" | "no">("");

  // Sort
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const { toast } = useToast();

  useEffect(() => {
    loadCards();
    loadSealed();
  }, []);

  const loadCards = async () => {
    try {
      const b = await getAllBatches();
      setBatches(b);
    } catch {
      toast("error", "Failed to load collection");
    } finally {
      setCardsLoading(false);
    }
  };

  const loadSealed = async () => {
    try {
      const res = await fetch("/api/sealed-items?limit=200");
      if (res.ok) {
        const d = await res.json();
        setSealedItems(d.items ?? []);
      }
    } catch {
      // Non-fatal
    } finally {
      setSealedLoading(false);
    }
  };

  const deleteSealed = async (id: string) => {
    // Optimistic remove
    setSealedItems((prev) => prev.filter((s) => s.id !== id));
    try {
      const res = await fetch(`/api/sealed-items/${id}`, { method: "DELETE" });
      if (!res.ok) {
        // Revert
        loadSealed();
        toast("error", "Failed to delete item");
      }
    } catch {
      loadSealed();
      toast("error", "Failed to delete item");
    }
  };

  // Flatten all cards across batches
  const allCards: CardWithBatch[] = useMemo(() => {
    const cards: CardWithBatch[] = [];
    for (const b of batches) {
      for (const c of b.cards) {
        cards.push({ ...c, batchId: b.id, batchName: b.name });
      }
    }
    return cards;
  }, [batches]);

  const cardById = useMemo(() => {
    const map = new Map<string, CardWithBatch>();
    for (const c of allCards) map.set(c.id, c);
    return map;
  }, [allCards]);

  const duplicateGroups = useMemo(() => detectDuplicates(allCards), [allCards]);

  const filtered = useMemo(() => {
    let result = allCards;
    if (query.trim()) {
      const q = query.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.setName?.toLowerCase().includes(q) ||
          c.setCode?.toLowerCase().includes(q) ||
          c.collectorNumber?.toLowerCase().includes(q) ||
          c.batchName.toLowerCase().includes(q)
      );
    }
    if (filterGame) result = result.filter((c) => c.game === filterGame);
    if (filterCondition) result = result.filter((c) => c.condition === filterCondition);
    if (filterBatch) result = result.filter((c) => c.batchId === filterBatch);
    if (filterFoil === "yes") result = result.filter((c) => c.foil);
    if (filterFoil === "no") result = result.filter((c) => !c.foil);
    if (filterGraded === "yes") result = result.filter((c) => c.slabbed);
    if (filterGraded === "no") result = result.filter((c) => !c.slabbed);
    return result;
  }, [allCards, query, filterGame, filterCondition, filterBatch, filterFoil, filterGraded]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      switch (sortField) {
        case "name":  return dir * a.name.localeCompare(b.name);
        case "price": return dir * ((a.marketPriceUsd ?? 0) - (b.marketPriceUsd ?? 0));
        case "game":  return dir * (GAME_LABELS[a.game] || "").localeCompare(GAME_LABELS[b.game] || "");
        default:      return dir * ((a.createdAt || 0) - (b.createdAt || 0));
      }
    });
    return arr;
  }, [filtered, sortField, sortDir]);

  // Sealed filtering
  const filteredSealed = useMemo(() => {
    let result = sealedItems;
    if (sealedQuery.trim()) {
      const q = sealedQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.product_name?.toLowerCase().includes(q) ||
          s.set_name?.toLowerCase().includes(q) ||
          s.game?.toLowerCase().includes(q)
      );
    }
    if (sealedFilterGame) result = result.filter((s) => s.game === sealedFilterGame);
    if (sealedFilterCondition) result = result.filter((s) => s.condition === sealedFilterCondition);
    return result;
  }, [sealedItems, sealedQuery, sealedFilterGame, sealedFilterCondition]);

  const totalCardValue = allCards.reduce((s, c) => s + (c.marketPriceUsd ?? 0) * (c.quantity || 1), 0);
  const totalCardQty = allCards.reduce((s, c) => s + (c.quantity || 1), 0);
  const totalSealedValue = sealedItems.reduce((s, i) => s + (i.market_price_usd ?? 0), 0);

  const gamesPresent = useMemo(() => {
    const set = new Set(allCards.map((c) => c.game));
    return Array.from(set).sort();
  }, [allCards]);

  const sealedGamesPresent = useMemo(() => {
    const set = new Set(sealedItems.map((s) => s.game).filter(Boolean) as string[]);
    return Array.from(set).sort();
  }, [sealedItems]);

  const activeFilterCount = [filterGame, filterCondition, filterBatch, filterFoil, filterGraded].filter(Boolean).length;
  const clearFilters = () => {
    setFilterGame(""); setFilterCondition(""); setFilterBatch(""); setFilterFoil(""); setFilterGraded("");
  };
  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "name" || field === "game" ? "asc" : "desc"); }
  };

  const loading = cardsLoading || sealedLoading;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catalog</h1>
          <p className="text-sm text-muted mt-1">Your full inventory</p>
        </div>
        <BatchSkeleton />
        <BatchSkeleton />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Catalog</h1>
          <p className="text-sm text-muted mt-1">
            {totalCardQty} card{totalCardQty !== 1 ? "s" : ""}
            {sealedItems.length > 0 && ` · ${sealedItems.length} sealed product${sealedItems.length !== 1 ? "s" : ""}`}
            {(totalCardValue + totalSealedValue) > 0 && (
              <span className="ml-2 text-accent font-medium">
                &middot; ${(totalCardValue + totalSealedValue).toFixed(2)} est. value
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="flex gap-2 p-1 rounded-xl bg-surface-2 border border-border w-fit">
        <button
          onClick={() => setTab("cards")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "cards" ? "bg-brand text-white shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          <CreditCard className="w-4 h-4" />
          Cards
          {allCards.length > 0 && (
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === "cards" ? "bg-white/20" : "bg-surface text-muted"}`}>
              {allCards.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("sealed")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "sealed" ? "bg-brand text-white shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          <Package className="w-4 h-4" />
          Sealed
          {sealedItems.length > 0 && (
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === "sealed" ? "bg-white/20" : "bg-surface text-muted"}`}>
              {sealedItems.length}
            </span>
          )}
        </button>
      </div>

      {/* ── CARDS TAB ────────────────────────────────────────────── */}
      {tab === "cards" && (
        <>
          {/* View toggle */}
          <div className="flex items-center justify-end gap-2">
            <button className={`btn p-2 ${view === "grid" ? "border-accent/50 text-accent" : ""}`} onClick={() => setView("grid")} title="Grid view">
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button className={`btn p-2 ${view === "list" ? "border-accent/50 text-accent" : ""}`} onClick={() => setView("list")} title="List view">
              <List className="w-4 h-4" />
            </button>
            <button
              className={`btn gap-1.5 text-xs ${view === "duplicates" ? "border-accent/50 text-accent" : ""}`}
              onClick={() => setView("duplicates")}
            >
              <Copy className="w-4 h-4" />
              Duplicates
              {duplicateGroups.length > 0 && (
                <span className="ml-0.5 w-5 h-5 rounded-full bg-accent text-black text-[10px] font-bold flex items-center justify-center">
                  {duplicateGroups.length}
                </span>
              )}
            </button>
          </div>

          {/* Search + Filter bar */}
          {view !== "duplicates" && (
            <>
              <div className="flex items-center gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    className="input pl-10"
                    placeholder="Search by name, set, number, or batch..."
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  {query && (
                    <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <button className={`btn ${activeFilterCount > 0 ? "border-accent/50 text-accent" : ""}`} onClick={() => setShowFilters((v) => !v)}>
                  <Filter className="w-4 h-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="ml-1 w-5 h-5 rounded-full bg-accent text-black text-[10px] font-bold flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>

              {showFilters && (
                <div className="card-panel p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-medium text-muted uppercase tracking-wider">Filters</span>
                    {activeFilterCount > 0 && (
                      <button onClick={clearFilters} className="text-xs text-accent hover:underline">Clear all</button>
                    )}
                  </div>
                  <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    <div>
                      <label className="label">Game</label>
                      <select className="input mt-1" value={filterGame} onChange={(e) => setFilterGame(e.target.value as Game | "")}>
                        <option value="">All games</option>
                        {gamesPresent.map((g) => (
                          <option key={g} value={g}>{GAME_LABELS[g as Game] || g}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Condition</label>
                      <select className="input mt-1" value={filterCondition} onChange={(e) => setFilterCondition(e.target.value as Condition | "")}>
                        <option value="">All conditions</option>
                        {CONDITIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Batch</label>
                      <select className="input mt-1" value={filterBatch} onChange={(e) => setFilterBatch(e.target.value)}>
                        <option value="">All batches</option>
                        {batches.map((b) => (
                          <option key={b.id} value={b.id}>{b.name} ({b.cards.length})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Foil</label>
                      <select className="input mt-1" value={filterFoil} onChange={(e) => setFilterFoil(e.target.value as "" | "yes" | "no")}>
                        <option value="">Any</option>
                        <option value="yes">Foil only</option>
                        <option value="no">Non-foil only</option>
                      </select>
                    </div>
                    <div>
                      <label className="label">Graded</label>
                      <select className="input mt-1" value={filterGraded} onChange={(e) => setFilterGraded(e.target.value as "" | "yes" | "no")}>
                        <option value="">Any</option>
                        <option value="yes">Graded only</option>
                        <option value="no">Raw only</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1 text-xs text-muted">
                <ArrowUpDown className="w-3.5 h-3.5" />
                <span>Sort:</span>
                {(["date", "name", "price", "game"] as SortField[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => toggleSort(f)}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      sortField === f ? "bg-accent/10 text-accent font-medium" : "hover:bg-panel2 hover:text-white"
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                    {sortField === f && (sortDir === "asc" ? " ↑" : " ↓")}
                  </button>
                ))}
                <span className="ml-auto text-muted">{sorted.length} result{sorted.length !== 1 ? "s" : ""}</span>
              </div>
            </>
          )}

          {view === "duplicates" ? (
            <DuplicatesView groups={duplicateGroups} cardById={cardById} />
          ) : allCards.length === 0 ? (
            <div className="card-panel flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
                <Library className="w-8 h-8 text-accent" />
              </div>
              <h2 className="text-lg font-semibold mb-2">No cards yet</h2>
              <p className="text-sm text-muted max-w-md mb-6">
                Scan your first batch of cards to build your collection.
              </p>
              <Link href="/scan" className="btn-primary">
                <ScanLine className="w-4 h-4" />
                Start Scanning
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : sorted.length === 0 ? (
            <div className="card-panel flex flex-col items-center justify-center py-12 text-center">
              <Search className="w-8 h-8 text-muted mb-3" />
              <p className="text-sm text-muted">No cards match your search or filters.</p>
              <button onClick={() => { setQuery(""); clearFilters(); }} className="text-sm text-accent hover:underline mt-2">
                Clear all filters
              </button>
            </div>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {sorted.map((card) => <GridCard key={`${card.batchId}-${card.id}`} card={card} />)}
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((card) => <ListCard key={`${card.batchId}-${card.id}`} card={card} />)}
            </div>
          )}
        </>
      )}

      {/* ── SEALED TAB ───────────────────────────────────────────── */}
      {tab === "sealed" && (
        <SealedTab
          items={filteredSealed}
          allItems={sealedItems}
          gamesPresent={sealedGamesPresent}
          query={sealedQuery}
          filterGame={sealedFilterGame}
          filterCondition={sealedFilterCondition}
          totalValue={totalSealedValue}
          onQueryChange={setSealedQuery}
          onFilterGameChange={setSealedFilterGame}
          onFilterConditionChange={setSealedFilterCondition}
          onDelete={deleteSealed}
        />
      )}
    </div>
  );
}

// ── Sealed Tab ───────────────────────────────────────────────────────────────

function SealedTab({
  items,
  allItems,
  gamesPresent,
  query,
  filterGame,
  filterCondition,
  totalValue,
  onQueryChange,
  onFilterGameChange,
  onFilterConditionChange,
  onDelete,
}: {
  items: SealedItem[];
  allItems: SealedItem[];
  gamesPresent: string[];
  query: string;
  filterGame: string;
  filterCondition: SealedCondition | "";
  totalValue: number;
  onQueryChange: (v: string) => void;
  onFilterGameChange: (v: string) => void;
  onFilterConditionChange: (v: SealedCondition | "") => void;
  onDelete: (id: string) => void;
}) {
  if (allItems.length === 0) {
    return (
      <div className="card-panel flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
          <Package className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-lg font-semibold mb-2">No sealed products yet</h2>
        <p className="text-sm text-muted max-w-md mb-6">
          Scan booster boxes, ETBs, tins, and more to track your sealed inventory with live eBay pricing.
        </p>
        <Link href="/scan" className="btn-primary">
          <ScanLine className="w-4 h-4" />
          Scan Sealed Products
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm text-muted">
        <span>{allItems.length} product{allItems.length !== 1 ? "s" : ""}</span>
        {totalValue > 0 && (
          <span className="text-accent font-medium">&middot; ${totalValue.toFixed(2)} est. value</span>
        )}
      </div>

      {/* Search + filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            className="input pl-10"
            placeholder="Search by name, set, or game..."
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          {query && (
            <button onClick={() => onQueryChange("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select
          className="input w-auto"
          value={filterGame}
          onChange={(e) => onFilterGameChange(e.target.value)}
        >
          <option value="">All games</option>
          {gamesPresent.map((g) => (
            <option key={g} value={g}>{GAME_LABELS[g as Game] || g}</option>
          ))}
        </select>
        <select
          className="input w-auto"
          value={filterCondition}
          onChange={(e) => onFilterConditionChange(e.target.value as SealedCondition | "")}
        >
          <option value="">All conditions</option>
          {(Object.entries(SEALED_CONDITION_LABELS) as [SealedCondition, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <div className="card-panel flex flex-col items-center justify-center py-12 text-center">
          <Search className="w-8 h-8 text-muted mb-3" />
          <p className="text-sm text-muted">No sealed products match your search.</p>
          <button onClick={() => { onQueryChange(""); onFilterGameChange(""); onFilterConditionChange(""); }} className="text-sm text-accent hover:underline mt-2">
            Clear filters
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <SealedItemRow key={item.id} item={item} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sealed item row ───────────────────────────────────────────────────────────

function SealedItemRow({ item, onDelete }: { item: SealedItem; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const conditionLabel = SEALED_CONDITION_LABELS[item.condition] ?? item.condition;
  const productTypeLabel = item.product_type
    ? (SEALED_PRODUCT_LABELS[item.product_type as keyof typeof SEALED_PRODUCT_LABELS] ?? item.product_type)
    : null;
  const gameLabel = item.game ? (GAME_LABELS[item.game as Game] ?? item.game) : null;
  const date = new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  return (
    <div className="card-panel overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-brand" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">
              {item.product_name ?? <span className="text-muted italic">Unknown Product</span>}
            </span>
            {productTypeLabel && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-surface-2 border border-border text-muted">
                {productTypeLabel}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted flex-wrap">
            {gameLabel && <span>{gameLabel}</span>}
            {item.set_name && <span>· {item.set_name}</span>}
            {item.language && item.language !== "English" && (
              <span className="flex items-center gap-0.5">
                <Globe className="w-3 h-3" />
                {item.language}
              </span>
            )}
            {item.edition && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-400">
                {item.edition}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-[11px] text-muted">
            <span>{conditionLabel}</span>
            <span className="text-muted/50">·</span>
            <span>{date}</span>
          </div>
        </div>

        {/* Price */}
        <div className="text-right shrink-0">
          {item.market_price_usd != null ? (
            <div>
              <span className="text-sm font-bold text-accent2">${item.market_price_usd.toFixed(2)}</span>
              {item.price_sample_size != null && (
                <p className="text-[10px] text-muted">{item.price_sample_size} sales</p>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted">—</span>
          )}
        </div>

        {/* Expand / Delete */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-surface-2 transition-colors"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={() => onDelete(item.id)}
                className="px-2 py-1 rounded-lg text-xs font-medium bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/20 transition-colors"
              >
                Confirm
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="p-1.5 rounded-lg text-muted hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded-lg text-muted hover:text-red-400 hover:bg-red-500/10 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border px-4 py-3 bg-surface-2 space-y-2 text-xs text-muted">
          {item.price_source && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-brand" />
              <span>Price source: {item.price_source}</span>
            </div>
          )}
          {item.confidence != null && (
            <div className="flex items-center gap-1.5">
              <AlertCircle className="w-3 h-3" />
              <span>Scan confidence: {Math.round(item.confidence * 100)}%</span>
            </div>
          )}
          {item.reasoning && (
            <p className="leading-relaxed">{item.reasoning}</p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Duplicates view ──────────────────────────────────────────────────────────

function DuplicatesView({ groups, cardById }: { groups: DuplicateGroup[]; cardById: Map<string, CardWithBatch> }) {
  if (groups.length === 0) {
    return (
      <div className="card-panel flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-5">
          <Copy className="w-8 h-8 text-green-400" />
        </div>
        <h2 className="text-lg font-semibold mb-2">No duplicates found</h2>
        <p className="text-sm text-muted max-w-sm">Every card appears to be unique across your collection.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted">
        {groups.length} duplicate group{groups.length !== 1 ? "s" : ""} detected
      </p>
      {groups.map((group, i) => (
        <DuplicateGroupCard key={i} group={group} cardById={cardById} />
      ))}
    </div>
  );
}

function DuplicateGroupCard({ group, cardById }: { group: DuplicateGroup; cardById: Map<string, CardWithBatch> }) {
  const allGroupCards = [group.primary, ...group.duplicates];
  const confidencePct = Math.round(group.confidence * 100);
  const batchIds = new Set(allGroupCards.map((c) => cardById.get(c.id)?.batchId).filter(Boolean));
  const crossBatch = batchIds.size > 1;
  const badgeClass =
    confidencePct >= 90 ? "bg-red-500/15 border-red-500/30 text-red-400"
    : confidencePct >= 75 ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
    : "bg-yellow-500/15 border-yellow-500/30 text-yellow-400";

  return (
    <div className="card-panel p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-panel2/40">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClass}`}>
          {confidencePct}% match
        </span>
        <span className="text-sm font-medium">{group.primary.name}</span>
        <span className="text-xs text-muted ml-auto">{allGroupCards.length} cop{allGroupCards.length !== 1 ? "ies" : "y"}</span>
      </div>
      <div className="divide-y divide-border">
        {allGroupCards.map((card, idx) => {
          const enriched = cardById.get(card.id);
          const batchName = enriched?.batchName ?? "Unknown batch";
          const batchId = enriched?.batchId;
          return (
            <div key={card.id} className="flex items-center gap-4 px-4 py-3">
              <span className="w-5 h-5 rounded-full bg-panel2 border border-border text-[10px] font-bold text-muted flex items-center justify-center shrink-0">{idx + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium truncate">{card.name}</span>
                  {card.foil && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">Foil</span>}
                  {card.slabbed && card.grading && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400">
                      <Award className="w-3 h-3" />
                      {GRADING_COMPANY_LABELS[card.grading.company]} {card.grading.grade}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5 text-xs text-muted flex-wrap">
                  {card.setName && <span>{card.setName}</span>}
                  {card.collectorNumber && <span>#{card.collectorNumber}</span>}
                  {card.condition && <span>{card.condition}</span>}
                  <span className="text-muted/60">·</span>
                  <span className="text-accent/80">{batchName}</span>
                </div>
              </div>
              <div className="text-right shrink-0">
                {card.marketPriceUsd != null && card.marketPriceUsd > 0 ? (
                  <span className="text-sm font-semibold text-accent2">${card.marketPriceUsd.toFixed(2)}</span>
                ) : (
                  <span className="text-xs text-muted">—</span>
                )}
              </div>
              {batchId && (
                <Link href={`/scan?batch=${batchId}`} className="shrink-0 text-muted hover:text-accent transition-colors" title="Open batch">
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          );
        })}
      </div>
      <div className="px-4 py-2.5 border-t border-border bg-panel2/20">
        <p className="text-[11px] text-muted">
          {crossBatch ? "These cards appear in different batches" : "These cards appear in the same batch"}
        </p>
      </div>
    </div>
  );
}

// ── Grid card ──────────────────────────────────────────────────────────────

function GridCard({ card }: { card: CardWithBatch }) {
  const photoUrl = card.photos?.[0]?.dataUrl || card.imageUrl;
  return (
    <Link href={`/scan?batch=${card.batchId}`} className="card-panel p-0 overflow-hidden hover:border-accent/30 transition-colors group">
      <div className="aspect-[2.5/3.5] bg-panel2 relative overflow-hidden">
        {photoUrl ? (
          <img src={photoUrl} alt={card.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-8 h-8 text-muted/30" />
          </div>
        )}
        {card.marketPriceUsd != null && card.marketPriceUsd > 0 && (
          <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] font-semibold text-accent2 backdrop-blur-sm">
            ${card.marketPriceUsd.toFixed(2)}
          </span>
        )}
        <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
          {card.foil && (
            <span className="px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] font-medium text-yellow-400 backdrop-blur-sm">Foil</span>
          )}
          {card.slabbed && card.grading && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[10px] font-medium text-amber-400 backdrop-blur-sm">
              <Award className="w-3 h-3" />
              {GRADING_COMPANY_LABELS[card.grading.company]} {card.grading.grade}
            </span>
          )}
        </div>
      </div>
      <div className="p-2.5">
        <p className="text-xs font-semibold truncate">{card.name}</p>
        <p className="text-[10px] text-muted truncate mt-0.5">
          {card.setName || GAME_LABELS[card.game]}
          {card.collectorNumber && ` #${card.collectorNumber}`}
        </p>
        <div className="flex items-center gap-1.5 mt-1.5">
          <span className="chip text-[9px]">{GAME_LABELS[card.game]?.split(":")[0] || card.game}</span>
          {card.quantity > 1 && <span className="chip text-[9px]">×{card.quantity}</span>}
        </div>
      </div>
    </Link>
  );
}

// ── List card ──────────────────────────────────────────────────────────────

function ListCard({ card }: { card: CardWithBatch }) {
  const photoUrl = card.photos?.[0]?.dataUrl || card.imageUrl;
  return (
    <Link href={`/scan?batch=${card.batchId}`} className="card-panel flex items-center gap-4 hover:border-accent/30 transition-colors py-3">
      <div className="w-12 h-16 rounded-lg bg-panel2 border border-border overflow-hidden shrink-0">
        {photoUrl ? (
          <img src={photoUrl} alt={card.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-5 h-5 text-muted/30" />
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm truncate">{card.name}</span>
          {card.foil && (
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-yellow-500/10 border border-yellow-500/30 text-yellow-400">Foil</span>
          )}
          {card.slabbed && card.grading && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Award className="w-3 h-3" />
              {GRADING_COMPANY_LABELS[card.grading.company]} {card.grading.grade}
              {card.grading.verified && <ShieldCheck className="w-3 h-3 text-green-400" />}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
          <span>{card.setName || "—"}</span>
          {card.collectorNumber && <span>#{card.collectorNumber}</span>}
          <span className="chip text-[9px]">{GAME_LABELS[card.game]?.split(":")[0] || card.game}</span>
        </div>
        <div className="flex items-center gap-3 mt-1 text-[11px] text-muted">
          <span>{card.condition}</span>
          {card.quantity > 1 && <span>×{card.quantity}</span>}
          <span className="text-muted/50">{card.batchName}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        {card.marketPriceUsd != null && card.marketPriceUsd > 0 ? (
          <span className="text-sm font-semibold text-accent2">${card.marketPriceUsd.toFixed(2)}</span>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
      </div>
    </Link>
  );
}
