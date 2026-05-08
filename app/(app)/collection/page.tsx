"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
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
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Trash2,
  Download,
  CheckSquare,
  Square,
  Layers,
  DollarSign,
  Minus,
  Pencil,
  Check,
  Heart,
} from "lucide-react";
import { getAllBatches, type Batch } from "@/lib/supabaseStore";
import type { ScannedCard, Game, Condition, SealedCondition } from "@/lib/types";
import { GAME_LABELS, CONDITIONS, GRADING_COMPANY_LABELS, SEALED_PRODUCT_LABELS, SEALED_CONDITION_LABELS } from "@/lib/types";
import { useToast } from "@/components/Toast";
import { BatchSkeleton } from "@/components/Skeleton";
import { detectDuplicates, type DuplicateGroup } from "@/lib/duplicates";
import { PortfolioChart, type PortfolioSnapshot } from "@/components/PortfolioChart";
import WishlistTab from "@/components/WishlistTab";

// ── Types ──────────────────────────────────────────────────────────────────────

type CollectionTab = "cards" | "sealed" | "sets" | "wishlist";
type ViewMode = "grid" | "list" | "duplicates";
type SortField = "name" | "price" | "date" | "game";
type SortDir = "asc" | "desc";
type ExportFormat = "ebay" | "tcgplayer" | "whatnot" | "csv";

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
  purchase_price_usd: number | null;
  created_at: string;
}

interface SetGroup {
  game: Game | string;
  setName: string;
  cards: CardWithBatch[];
  totalValue: number;
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function CollectionPage() {
  return (
    <Suspense>
      <CollectionContent />
    </Suspense>
  );
}

function CollectionContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get("tab") as CollectionTab | null) ?? "cards";
  const [tab, setTab] = useState<CollectionTab>(initialTab);

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

  // Portfolio chart
  const [snapshots, setSnapshots] = useState<PortfolioSnapshot[]>([]);
  const snapshotRecorded = useRef(false);

  // Export multi-select (cards tab list view)
  const [selectedCardIds, setSelectedCardIds] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

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
    loadPortfolioSnapshots();
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

  const loadPortfolioSnapshots = async () => {
    try {
      const res = await fetch("/api/portfolio/snapshot?days=60");
      if (res.ok) {
        const d = await res.json();
        setSnapshots(d.snapshots ?? []);
      }
    } catch {
      // Non-fatal
    }
  };

  const deleteSealed = async (id: string) => {
    setSealedItems((prev) => prev.filter((s) => s.id !== id));
    try {
      const res = await fetch(`/api/sealed-items/${id}`, { method: "DELETE" });
      if (!res.ok) {
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

  const totalCardValue = allCards.reduce((s, c) => s + (c.marketPriceUsd ?? 0) * (c.quantity || 1), 0);
  const totalCardQty   = allCards.reduce((s, c) => s + (c.quantity || 1), 0);
  const totalSealedValue = sealedItems.reduce((s, i) => s + (i.market_price_usd ?? 0), 0);
  const totalPortfolioValue = totalCardValue + totalSealedValue;

  // Record portfolio snapshot once per session (after both card + sealed data loaded)
  useEffect(() => {
    if (!cardsLoading && !sealedLoading && !snapshotRecorded.current) {
      snapshotRecorded.current = true;
      if (totalPortfolioValue > 0 || allCards.length > 0 || sealedItems.length > 0) {
        fetch("/api/portfolio/snapshot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            totalValueUsd: totalPortfolioValue,
            cardCount:     totalCardQty,
            sealedCount:   sealedItems.length,
          }),
        })
          .then(async (r) => {
            if (r.ok && !(await r.json().then((d) => d.skipped).catch(() => false))) {
              // Refresh snapshots to include today's new point
              loadPortfolioSnapshots();
            }
          })
          .catch(() => {});
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardsLoading, sealedLoading]);

  // Card filtering & sorting
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
    if (filterGame)      result = result.filter((c) => c.game === filterGame);
    if (filterCondition) result = result.filter((c) => c.condition === filterCondition);
    if (filterBatch)     result = result.filter((c) => c.batchId === filterBatch);
    if (filterFoil === "yes")    result = result.filter((c) => c.foil);
    if (filterFoil === "no")     result = result.filter((c) => !c.foil);
    if (filterGraded === "yes")  result = result.filter((c) => c.slabbed);
    if (filterGraded === "no")   result = result.filter((c) => !c.slabbed);
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
    if (sealedFilterGame)      result = result.filter((s) => s.game === sealedFilterGame);
    if (sealedFilterCondition) result = result.filter((s) => s.condition === sealedFilterCondition);
    return result;
  }, [sealedItems, sealedQuery, sealedFilterGame, sealedFilterCondition]);

  // Set completion data
  const setGroups = useMemo<SetGroup[]>(() => {
    const map = new Map<string, SetGroup>();
    for (const c of allCards) {
      const setLabel = c.setName || "(Unknown Set)";
      const key = `${c.game}:${setLabel}`;
      if (!map.has(key)) {
        map.set(key, { game: c.game, setName: setLabel, cards: [], totalValue: 0 });
      }
      const g = map.get(key)!;
      g.cards.push(c);
      g.totalValue += (c.marketPriceUsd ?? 0) * (c.quantity || 1);
    }
    return Array.from(map.values()).sort((a, b) => b.cards.length - a.cards.length);
  }, [allCards]);

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

  // Export selection helpers
  const toggleCardSelect = (id: string) => {
    setSelectedCardIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const selectAllVisible = () => setSelectedCardIds(new Set(sorted.map((c) => c.id)));
  const clearSelection   = () => setSelectedCardIds(new Set());

  const handleExport = async (format: ExportFormat) => {
    const cards = sorted.filter((c) => selectedCardIds.has(c.id));
    if (cards.length === 0) return;
    setIsExporting(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards, format }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") || "";
      const filename = cd.match(/filename="?([^"]+)"?/)?.[1] || `export.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.click();
      URL.revokeObjectURL(url);
      toast("success", `${cards.length} card${cards.length !== 1 ? "s" : ""} exported as ${format.toUpperCase()}`);
      clearSelection();
    } catch {
      toast("error", "Export failed — please try again");
    } finally {
      setIsExporting(false);
    }
  };

  const loading = cardsLoading || sealedLoading;

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Collection</h1>
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
          <h1 className="text-2xl font-bold tracking-tight">Collection</h1>
          <p className="text-sm text-muted mt-1">
            {totalCardQty} card{totalCardQty !== 1 ? "s" : ""}
            {sealedItems.length > 0 && ` · ${sealedItems.length} sealed`}
            {totalPortfolioValue > 0 && (
              <span className="ml-2 text-accent font-medium">
                &middot; ${totalPortfolioValue.toFixed(2)} est. value
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Portfolio chart — always visible */}
      {(allCards.length > 0 || sealedItems.length > 0) && (
        <PortfolioChart
          snapshots={snapshots}
          currentValue={totalPortfolioValue}
          cardCount={totalCardQty}
          sealedCount={sealedItems.length}
        />
      )}

      {/* Tab toggle */}
      <div className="flex gap-2 p-1 rounded-xl bg-panel2 border border-border w-fit">
        <button
          onClick={() => setTab("cards")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "cards" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
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
            tab === "sealed" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
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
        <button
          onClick={() => setTab("sets")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "sets" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          <Layers className="w-4 h-4" />
          Sets
          {setGroups.length > 0 && (
            <span className={`ml-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${tab === "sets" ? "bg-white/20" : "bg-surface text-muted"}`}>
              {setGroups.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setTab("wishlist")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            tab === "wishlist" ? "bg-accent text-white shadow-sm" : "text-muted hover:text-foreground"
          }`}
        >
          <Heart className="w-4 h-4" />
          Wishlist
        </button>
      </div>

      {/* Export bar — floats above cards when cards are selected */}
      {selectedCardIds.size > 0 && tab === "cards" && (
        <div className="sticky top-4 z-20 flex items-center gap-3 flex-wrap px-4 py-3 rounded-xl bg-accent/10 border border-accent/30 backdrop-blur-sm">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckSquare className="w-4 h-4 text-accent" />
            {selectedCardIds.size} card{selectedCardIds.size !== 1 ? "s" : ""} selected
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            <button onClick={selectAllVisible} className="text-xs text-muted hover:text-foreground underline">
              Select all {sorted.length}
            </button>
            <button onClick={clearSelection} className="text-xs text-muted hover:text-foreground underline">
              Clear
            </button>
            {(["ebay", "tcgplayer", "whatnot", "csv"] as ExportFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => handleExport(fmt)}
                disabled={isExporting}
                className="btn text-xs flex items-center gap-1.5 border-accent/40 text-accent hover:bg-accent/10"
              >
                <Download className="w-3.5 h-3.5" />
                {fmt === "csv" ? "CSV" : fmt.charAt(0).toUpperCase() + fmt.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── CARDS TAB ─────────────────────────────────────────────── */}
      {tab === "cards" && (
        <>
          {/* View toggle */}
          <div className="flex items-center justify-end gap-2">
            <button className={`btn p-2 ${view === "grid" ? "border-accent/50 text-accent" : ""}`} onClick={() => { setView("grid"); clearSelection(); }} title="Grid view">
              <Grid3X3 className="w-4 h-4" />
            </button>
            <button className={`btn p-2 ${view === "list" ? "border-accent/50 text-accent" : ""}`} onClick={() => setView("list")} title="List view">
              <List className="w-4 h-4" />
            </button>
            <button
              className={`btn gap-1.5 text-xs ${view === "duplicates" ? "border-accent/50 text-accent" : ""}`}
              onClick={() => { setView("duplicates"); clearSelection(); }}
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
            <DuplicatesView groups={duplicateGroups} cardById={cardById} onExport={handleExport} isExporting={isExporting} />
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
              {sorted.map((card) => (
                <GridCard key={`${card.batchId}-${card.id}`} card={card} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {sorted.map((card) => (
                <ListCard
                  key={`${card.batchId}-${card.id}`}
                  card={card}
                  selected={selectedCardIds.has(card.id)}
                  onToggleSelect={() => toggleCardSelect(card.id)}
                />
              ))}
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
          onUpdate={(id, patch) => {
            setSealedItems((prev) =>
              prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
            );
          }}
        />
      )}

      {/* ── SETS TAB ─────────────────────────────────────────────── */}
      {tab === "sets" && (
        <SetsTab groups={setGroups} />
      )}

      {/* ── WISHLIST TAB ──────────────────────────────────────────── */}
      {tab === "wishlist" && (
        <WishlistTab />
      )}
    </div>
  );
}

// ── Sealed Tab ─────────────────────────────────────────────────────────────────

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
  onUpdate,
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
  onUpdate: (id: string, patch: Partial<SealedItem>) => void;
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

  // Total gain/loss across sealed items with a purchase price
  const gainLossItems = allItems.filter((s) => s.purchase_price_usd != null && s.market_price_usd != null);
  const totalGainLoss = gainLossItems.reduce(
    (sum, s) => sum + (s.market_price_usd! - s.purchase_price_usd!),
    0
  );
  const totalInvested = gainLossItems.reduce((sum, s) => sum + s.purchase_price_usd!, 0);
  const gainLossPct = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm flex-wrap">
        <span className="text-muted">{allItems.length} product{allItems.length !== 1 ? "s" : ""}</span>
        {totalValue > 0 && (
          <span className="text-accent font-medium">&middot; ${totalValue.toFixed(2)} market value</span>
        )}
        {gainLossItems.length > 0 && (
          <span className={`flex items-center gap-1 font-medium ${totalGainLoss >= 0 ? "text-green-400" : "text-red-400"}`}>
            &middot;
            {totalGainLoss >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            {totalGainLoss >= 0 ? "+" : ""}${totalGainLoss.toFixed(2)} ({gainLossPct >= 0 ? "+" : ""}{gainLossPct.toFixed(1)}%)
          </span>
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
            <SealedItemRow key={item.id} item={item} onDelete={onDelete} onUpdate={onUpdate} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sealed item row ─────────────────────────────────────────────────────────────

function SealedItemRow({
  item,
  onDelete,
  onUpdate,
}: {
  item: SealedItem;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<SealedItem>) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editingPurchasePrice, setEditingPurchasePrice] = useState(false);
  const [purchasePriceInput, setPurchasePriceInput] = useState(
    item.purchase_price_usd != null ? String(item.purchase_price_usd) : ""
  );
  const [savingPrice, setSavingPrice] = useState(false);

  const conditionLabel = SEALED_CONDITION_LABELS[item.condition] ?? item.condition;
  const productTypeLabel = item.product_type
    ? (SEALED_PRODUCT_LABELS[item.product_type as keyof typeof SEALED_PRODUCT_LABELS] ?? item.product_type)
    : null;
  const gameLabel = item.game ? (GAME_LABELS[item.game as Game] ?? item.game) : null;
  const date = new Date(item.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });

  const gain = item.market_price_usd != null && item.purchase_price_usd != null
    ? item.market_price_usd - item.purchase_price_usd
    : null;
  const gainPct = gain != null && item.purchase_price_usd! > 0
    ? (gain / item.purchase_price_usd!) * 100
    : null;

  const savePurchasePrice = async () => {
    const val = parseFloat(purchasePriceInput);
    const newVal = isNaN(val) || val <= 0 ? null : val;
    setSavingPrice(true);
    try {
      const res = await fetch(`/api/sealed-items/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ purchase_price_usd: newVal }),
      });
      if (res.ok) {
        onUpdate(item.id, { purchase_price_usd: newVal });
        setEditingPurchasePrice(false);
      }
    } finally {
      setSavingPrice(false);
    }
  };

  return (
    <div className="card-panel overflow-hidden">
      <div className="flex items-center gap-4 p-4">
        {/* Icon */}
        <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <Package className="w-5 h-5 text-accent" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm truncate">
              {item.product_name ?? <span className="text-muted italic">Unknown Product</span>}
            </span>
            {productTypeLabel && (
              <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-panel2 border border-border text-muted">
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

        {/* Prices + gain/loss */}
        <div className="text-right shrink-0 space-y-1">
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

          {/* Gain / loss chip */}
          {gain !== null && gainPct !== null ? (
            <div className={`flex items-center justify-end gap-1 text-[10px] font-medium ${gain >= 0 ? "text-green-400" : "text-red-400"}`}>
              {gain >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {gain >= 0 ? "+" : ""}{gain.toFixed(2)} ({gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)
            </div>
          ) : (
            /* Cost basis input trigger */
            item.market_price_usd != null && (
              <button
                onClick={() => { setEditingPurchasePrice(true); setExpanded(true); }}
                className="text-[10px] text-muted/50 hover:text-muted flex items-center gap-0.5 justify-end"
              >
                <DollarSign className="w-2.5 h-2.5" />
                Add cost
              </button>
            )
          )}
        </div>

        {/* Expand / Delete */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg text-muted hover:text-foreground hover:bg-panel2 transition-colors"
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
        <div className="border-t border-border px-4 py-3 bg-panel2 space-y-3 text-xs text-muted">

          {/* Purchase price */}
          <div className="flex items-center gap-3">
            <DollarSign className="w-3 h-3 text-accent shrink-0" />
            <span className="text-muted">Cost basis:</span>
            {editingPurchasePrice ? (
              <div className="flex items-center gap-2 flex-1">
                <div className="flex items-center gap-1">
                  <span className="text-muted">$</span>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    autoFocus
                    value={purchasePriceInput}
                    onChange={(e) => setPurchasePriceInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") savePurchasePrice(); if (e.key === "Escape") setEditingPurchasePrice(false); }}
                    className="input text-xs py-0.5 px-2 w-24"
                    placeholder="0.00"
                  />
                </div>
                <button onClick={savePurchasePrice} disabled={savingPrice} className="p-1 rounded text-green-400 hover:bg-green-500/10">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => setEditingPurchasePrice(false)} className="p-1 rounded text-muted hover:bg-panel2">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="font-medium text-foreground">
                  {item.purchase_price_usd != null ? `$${item.purchase_price_usd.toFixed(2)}` : "—"}
                </span>
                <button
                  onClick={() => setEditingPurchasePrice(true)}
                  className="p-0.5 rounded text-muted/50 hover:text-muted"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>

          {item.price_source && (
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3 text-accent" />
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

// ── Sets Tab ───────────────────────────────────────────────────────────────────

function SetsTab({ groups }: { groups: SetGroup[] }) {
  const [filterGame, setFilterGame] = useState("");
  const [query, setQuery] = useState("");

  if (groups.length === 0) {
    return (
      <div className="card-panel flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
          <Layers className="w-8 h-8 text-accent" />
        </div>
        <h2 className="text-lg font-semibold mb-2">No sets tracked yet</h2>
        <p className="text-sm text-muted max-w-md mb-6">
          Scan cards to see your collection broken down by set, with card counts and value per set.
        </p>
        <Link href="/scan" className="btn-primary">
          <ScanLine className="w-4 h-4" />
          Start Scanning
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    );
  }

  const gamesPresent = Array.from(new Set(groups.map((g) => g.game as string))).sort();

  const filtered = groups.filter((g) => {
    if (filterGame && g.game !== filterGame) return false;
    if (query.trim()) {
      const q = query.toLowerCase();
      if (!g.setName.toLowerCase().includes(q) && !(GAME_LABELS[g.game as Game] || g.game).toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const totalCards  = filtered.reduce((s, g) => s + g.cards.length, 0);
  const totalValue  = filtered.reduce((s, g) => s + g.totalValue, 0);
  const maxCards    = Math.max(...filtered.map((g) => g.cards.length), 1);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted flex-wrap">
        <span>{filtered.length} set{filtered.length !== 1 ? "s" : ""}</span>
        <span className="text-accent font-medium">&middot; {totalCards} cards</span>
        {totalValue > 0 && <span>&middot; ${totalValue.toFixed(2)}</span>}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            className="input pl-10"
            placeholder="Search by set or game..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query && (
            <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-white">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <select className="input w-auto" value={filterGame} onChange={(e) => setFilterGame(e.target.value)}>
          <option value="">All games</option>
          {gamesPresent.map((g) => (
            <option key={g} value={g}>{GAME_LABELS[g as Game] || g}</option>
          ))}
        </select>
      </div>

      {/* Set cards */}
      {filtered.length === 0 ? (
        <div className="card-panel flex items-center justify-center py-12 text-center">
          <p className="text-sm text-muted">No sets match your search.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((group) => (
            <SetGroupCard key={`${group.game}:${group.setName}`} group={group} maxCards={maxCards} />
          ))}
        </div>
      )}
    </div>
  );
}

function SetGroupCard({ group, maxCards }: { group: SetGroup; maxCards: number }) {
  const [expanded, setExpanded] = useState(false);
  const gameLabel  = GAME_LABELS[group.game as Game] || group.game;
  const fillPct    = Math.round((group.cards.length / maxCards) * 100);
  const uniqueConditions = Array.from(new Set(group.cards.map((c) => c.condition)));

  return (
    <div className="card-panel overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-4 p-4 text-left hover:bg-panel2/50 transition-colors"
      >
        {/* Game badge */}
        <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0">
          <Layers className="w-5 h-5 text-accent" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-sm truncate">{group.setName}</span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
            <span>{gameLabel}</span>
            <span>·</span>
            <span>{group.cards.length} card{group.cards.length !== 1 ? "s" : ""}</span>
            {group.totalValue > 0 && (
              <>
                <span>·</span>
                <span className="text-accent2">${group.totalValue.toFixed(2)}</span>
              </>
            )}
          </div>
          {/* Progress bar (relative to largest set) */}
          <div className="mt-2 h-1.5 rounded-full bg-panel2 overflow-hidden w-full max-w-xs">
            <div
              className="h-full rounded-full bg-accent transition-all"
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>

        <ChevronDown className={`w-4 h-4 text-muted shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>

      {expanded && (
        <div className="border-t border-border">
          {/* Condition breakdown */}
          <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted border-b border-border bg-panel2/50 flex-wrap">
            {uniqueConditions.map((cond) => {
              const count = group.cards.filter((c) => c.condition === cond).length;
              return (
                <span key={cond} className="flex items-center gap-1">
                  <span className="font-medium text-foreground">{count}</span> {cond}
                </span>
              );
            })}
          </div>
          {/* Cards list */}
          <div className="divide-y divide-border max-h-72 overflow-y-auto">
            {group.cards.map((card) => (
              <div key={card.id} className="flex items-center gap-3 px-4 py-2.5">
                {/* Thumbnail */}
                <div className="w-8 h-11 rounded bg-panel2 border border-border overflow-hidden shrink-0">
                  {card.photos?.[0]?.dataUrl || card.imageUrl ? (
                    <img src={card.photos?.[0]?.dataUrl || card.imageUrl} alt={card.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ImageIcon className="w-3 h-3 text-muted/30" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{card.name}</p>
                  <p className="text-[10px] text-muted">
                    {card.collectorNumber && `#${card.collectorNumber} · `}{card.condition}
                    {card.foil && " · Foil"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {card.marketPriceUsd != null && card.marketPriceUsd > 0 ? (
                    <span className="text-xs font-semibold text-accent2">${card.marketPriceUsd.toFixed(2)}</span>
                  ) : (
                    <span className="text-[10px] text-muted">—</span>
                  )}
                </div>
                <Link href={`/scan?batch=${card.batchId}`} className="shrink-0 text-muted/40 hover:text-muted transition-colors">
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Duplicates view ────────────────────────────────────────────────────────────

function DuplicatesView({
  groups,
  cardById,
  onExport,
  isExporting,
}: {
  groups: DuplicateGroup[];
  cardById: Map<string, CardWithBatch>;
  onExport: (format: ExportFormat) => void;
  isExporting: boolean;
}) {
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
        <DuplicateGroupCard key={i} group={group} cardById={cardById} onExport={onExport} isExporting={isExporting} />
      ))}
    </div>
  );
}

function DuplicateGroupCard({
  group,
  cardById,
  onExport,
  isExporting,
}: {
  group: DuplicateGroup;
  cardById: Map<string, CardWithBatch>;
  onExport: (format: ExportFormat) => void;
  isExporting: boolean;
}) {
  const allGroupCards = [group.primary, ...group.duplicates];
  const confidencePct = Math.round(group.confidence * 100);
  const batchIds      = new Set(allGroupCards.map((c) => cardById.get(c.id)?.batchId).filter(Boolean));
  const crossBatch    = batchIds.size > 1;
  const badgeClass =
    confidencePct >= 90 ? "bg-red-500/15 border-red-500/30 text-red-400"
    : confidencePct >= 75 ? "bg-orange-500/15 border-orange-500/30 text-orange-400"
    : "bg-yellow-500/15 border-yellow-500/30 text-yellow-400";

  // "Sell extras" — export all copies except the first (keep 1)
  const extras = allGroupCards.slice(1).map((c) => cardById.get(c.id)).filter(Boolean) as CardWithBatch[];
  const bestPrice = allGroupCards.reduce((best, c) => Math.max(best, (cardById.get(c.id)?.marketPriceUsd ?? 0)), 0);

  return (
    <div className="card-panel p-0 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-panel2/40">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeClass}`}>
          {confidencePct}% match
        </span>
        <span className="text-sm font-medium">{group.primary.name}</span>
        <span className="text-xs text-muted ml-auto">{allGroupCards.length} cop{allGroupCards.length !== 1 ? "ies" : "y"}</span>
        {extras.length > 0 && bestPrice > 0 && (
          <div className="flex items-center gap-1 ml-2">
            <span className="text-[10px] text-muted">${(extras.length * bestPrice).toFixed(2)} sellable</span>
            <button
              onClick={() => onExport("ebay")}
              disabled={isExporting}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium bg-accent/10 border border-accent/30 text-accent hover:bg-accent/20 transition-colors"
              title={`Export ${extras.length} extra cop${extras.length !== 1 ? "ies" : "y"} to eBay`}
            >
              <Download className="w-3 h-3" />
              Sell extras
            </button>
          </div>
        )}
      </div>
      <div className="divide-y divide-border">
        {allGroupCards.map((card, idx) => {
          const enriched  = cardById.get(card.id);
          const batchName = enriched?.batchName ?? "Unknown batch";
          const batchId   = enriched?.batchId;
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
                  {idx === 0 && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-medium bg-green-500/10 border border-green-500/30 text-green-400">keep</span>}
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
          {extras.length > 0 && ` · ${extras.length} extra cop${extras.length !== 1 ? "ies" : "y"} that could be sold`}
        </p>
      </div>
    </div>
  );
}

// ── Grid card ──────────────────────────────────────────────────────────────────

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
        {/* Condition chip — bottom right */}
        <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/70 text-[9px] font-medium text-white/70 backdrop-blur-sm truncate max-w-[80px]">
          {card.condition}
        </span>
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

// ── List card ──────────────────────────────────────────────────────────────────

function ListCard({
  card,
  selected,
  onToggleSelect,
}: {
  card: CardWithBatch;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const photoUrl = card.photos?.[0]?.dataUrl || card.imageUrl;
  return (
    <div className={`card-panel flex items-center gap-4 py-3 transition-colors ${selected ? "border-accent/50 bg-accent/5" : "hover:border-accent/30"}`}>
      {/* Checkbox */}
      <button
        onClick={onToggleSelect}
        className="shrink-0 text-muted hover:text-accent transition-colors p-1"
      >
        {selected ? <CheckSquare className="w-4 h-4 text-accent" /> : <Square className="w-4 h-4" />}
      </button>

      {/* Card link */}
      <Link href={`/scan?batch=${card.batchId}`} className="flex items-center gap-4 flex-1 min-w-0">
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
      </Link>

      <div className="text-right shrink-0">
        {card.marketPriceUsd != null && card.marketPriceUsd > 0 ? (
          <span className="text-sm font-semibold text-accent2">${card.marketPriceUsd.toFixed(2)}</span>
        ) : (
          <span className="text-xs text-muted">—</span>
        )}
      </div>
    </div>
  );
}
