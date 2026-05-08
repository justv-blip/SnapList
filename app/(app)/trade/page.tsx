"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  ArrowLeftRight,
  Plus,
  Trash2,
  Search,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  DollarSign,
  CheckCircle2,
  Loader2,
  ImageIcon,
  X,
} from "lucide-react";
import { GAME_LABELS, type Game } from "@/lib/types";
import { UpgradeGate } from "@/components/UpgradeGate";
import { createClient } from "@/lib/supabase/client";

interface TradeCard {
  id: string;
  name: string;
  game: Game;
  setName?: string;
  imageUrl?: string;
  marketPrice: number;
}

type TradeSide = "giving" | "receiving";

function uuid() {
  return crypto.randomUUID();
}

// Games to show in the selector — full list minus catch-alls
const GAME_OPTIONS: Game[] = [
  "pokemon", "mtg", "yugioh", "lorcana", "onepiece", "digimon",
  "fleshandblood", "dragonball", "gundam", "vanguard", "weissschwarz",
  "finalfantasy", "unionarena", "battlespirits", "riftbound", "sports",
];

export default function TradeAnalyzerPage() {
  const [giving, setGiving] = useState<TradeCard[]>([]);
  const [receiving, setReceiving] = useState<TradeCard[]>([]);
  const [addingSide, setAddingSide] = useState<TradeSide | null>(null);
  const [userTier, setUserTier] = useState<string>("free");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await createClient().from("profiles").select("subscription_tier").single();
        if (data?.subscription_tier) setUserTier(data.subscription_tier);
      } catch { /* non-critical */ }
    })();
  }, []);

  // Dialog state
  const [query, setQuery] = useState("");
  const [selectedGame, setSelectedGame] = useState<Game>("pokemon");
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundCard, setFoundCard] = useState<Partial<TradeCard> | null>(null);
  const [priceOverride, setPriceOverride] = useState<string>("");

  const givingTotal = useMemo(() => giving.reduce((s, c) => s + c.marketPrice, 0), [giving]);
  const receivingTotal = useMemo(() => receiving.reduce((s, c) => s + c.marketPrice, 0), [receiving]);
  const difference = receivingTotal - givingTotal;
  const percentDiff = givingTotal > 0 ? (difference / givingTotal) * 100 : 0;

  const openDialog = useCallback((side: TradeSide) => {
    setAddingSide(side);
    setQuery("");
    setSearchError(null);
    setFoundCard(null);
    setPriceOverride("");
  }, []);

  const closeDialog = useCallback(() => {
    setAddingSide(null);
    setFoundCard(null);
    setSearchError(null);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearchError(null);
    setFoundCard(null);

    try {
      const res = await fetch("/api/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ game: selectedGame, name: query.trim() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Lookup failed");

      if (data.found && data.match) {
        setFoundCard(data.match);
        setPriceOverride(
          data.match.marketPriceUsd != null
            ? String(data.match.marketPriceUsd.toFixed(2))
            : ""
        );
      } else {
        // No catalog hit — still allow adding manually
        setFoundCard({ name: query.trim(), game: selectedGame });
        setPriceOverride("");
      }
    } catch (err: any) {
      setSearchError(err?.message || "Could not look up card. Check your connection.");
    } finally {
      setSearching(false);
    }
  }, [query, selectedGame]);

  const confirmAdd = useCallback(() => {
    if (!foundCard || !addingSide) return;
    const price = parseFloat(priceOverride) || 0;
    const card: TradeCard = {
      id: uuid(),
      name: foundCard.name || query.trim(),
      game: foundCard.game || selectedGame,
      setName: foundCard.setName,
      imageUrl: foundCard.imageUrl,
      marketPrice: price,
    };
    if (addingSide === "giving") setGiving((p) => [...p, card]);
    else setReceiving((p) => [...p, card]);
    closeDialog();
  }, [foundCard, addingSide, priceOverride, query, selectedGame, closeDialog]);

  const removeCard = useCallback((side: TradeSide, id: string) => {
    const setter = side === "giving" ? setGiving : setReceiving;
    setter((p) => p.filter((c) => c.id !== id));
  }, []);

  const updatePrice = useCallback((side: TradeSide, id: string, price: number) => {
    const setter = side === "giving" ? setGiving : setReceiving;
    setter((p) => p.map((c) => (c.id === id ? { ...c, marketPrice: price } : c)));
  }, []);

  const verdict = useMemo(() => {
    if (giving.length === 0 && receiving.length === 0)
      return { label: "Add cards to both sides to analyze", color: "text-muted", icon: ArrowLeftRight };
    if (giving.length === 0 || receiving.length === 0)
      return { label: "Add cards to both sides", color: "text-muted", icon: ArrowLeftRight };
    if (Math.abs(percentDiff) <= 5)
      return { label: "Fair trade", color: "text-accent2", icon: CheckCircle2 };
    if (difference > 0)
      return { label: `You gain ~$${difference.toFixed(2)} (${percentDiff.toFixed(0)}%)`, color: "text-accent2", icon: TrendingUp };
    return { label: `You lose ~$${Math.abs(difference).toFixed(2)} (${Math.abs(percentDiff).toFixed(0)}%)`, color: "text-danger", icon: TrendingDown };
  }, [giving, receiving, difference, percentDiff]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Trade Analyzer</h1>
        <p className="text-sm text-muted mt-1">
          Compare card values on both sides of a trade to see if it&apos;s fair
        </p>
      </div>

      <UpgradeGate
        requiredTier="pro"
        currentTier={userTier}
        featureName="Trade Analyzer"
        description="Search live card prices, add cards to both sides of a trade, and instantly see if the deal is fair — available on Pro and above."
      />

      {/* Verdict banner */}
      <div className="card-panel flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-panel2 border border-border flex items-center justify-center shrink-0">
          <verdict.icon className={`w-6 h-6 ${verdict.color}`} />
        </div>
        <div className="flex-1">
          <p className={`font-semibold ${verdict.color}`}>{verdict.label}</p>
          {(giving.length > 0 || receiving.length > 0) && (
            <div className="flex items-center gap-4 mt-1 text-xs text-muted">
              <span>You give: <strong className="text-foreground">${givingTotal.toFixed(2)}</strong></span>
              <ArrowLeftRight className="w-3 h-3" />
              <span>You get: <strong className="text-foreground">${receivingTotal.toFixed(2)}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Two-column trade layout */}
      <div className="grid md:grid-cols-2 gap-4">
        <TradeSidePanel
          label="You Give"
          cards={giving}
          total={givingTotal}
          onAdd={() => openDialog("giving")}
          onRemove={(id) => removeCard("giving", id)}
          onPriceChange={(id, p) => updatePrice("giving", id, p)}
          color="text-danger"
        />
        <TradeSidePanel
          label="You Receive"
          cards={receiving}
          total={receivingTotal}
          onAdd={() => openDialog("receiving")}
          onRemove={(id) => removeCard("receiving", id)}
          onPriceChange={(id, p) => updatePrice("receiving", id, p)}
          color="text-accent2"
        />
      </div>

      {/* Add card dialog */}
      {addingSide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card-panel max-w-sm w-full mx-4 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">
                Add to &ldquo;{addingSide === "giving" ? "You Give" : "You Receive"}&rdquo;
              </h3>
              <button onClick={closeDialog} className="text-muted hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Game selector */}
            <div>
              <label className="label text-xs mb-1">Game</label>
              <select
                className="input text-sm w-full"
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value as Game)}
                disabled={!!foundCard}
              >
                {GAME_OPTIONS.map((g) => (
                  <option key={g} value={g}>{GAME_LABELS[g]}</option>
                ))}
              </select>
            </div>

            {/* Search input */}
            {!foundCard && (
              <>
                <div>
                  <label className="label text-xs mb-1">Card Name</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      className="input pl-9 w-full"
                      placeholder="e.g. Charizard ex, Lightning Bolt..."
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                      autoFocus
                      disabled={searching}
                    />
                  </div>
                </div>

                {searchError && (
                  <p className="text-xs text-danger">{searchError}</p>
                )}

                <div className="flex gap-3 justify-end">
                  <button className="btn" onClick={closeDialog}>Cancel</button>
                  <button
                    className="btn-primary"
                    onClick={handleSearch}
                    disabled={!query.trim() || searching}
                  >
                    {searching ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Looking up…</>
                    ) : (
                      <><Search className="w-4 h-4" /> Search</>
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Result */}
            {foundCard && (
              <>
                <div className="flex items-center gap-3 p-3 rounded-xl bg-panel2 border border-border">
                  {foundCard.imageUrl ? (
                    <img
                      src={foundCard.imageUrl}
                      alt={foundCard.name}
                      className="w-12 h-16 object-contain rounded"
                    />
                  ) : (
                    <div className="w-12 h-16 rounded bg-panel border border-border flex items-center justify-center shrink-0">
                      <ImageIcon className="w-5 h-5 text-muted" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{foundCard.name}</p>
                    {foundCard.setName && (
                      <p className="text-xs text-muted truncate">{foundCard.setName}</p>
                    )}
                    <p className="text-xs text-muted">{GAME_LABELS[foundCard.game || selectedGame]}</p>
                  </div>
                </div>

                <div>
                  <label className="label text-xs mb-1">
                    Market Price (USD)
                    {priceOverride === "" && (
                      <span className="text-muted ml-1">— no price found, enter manually</span>
                    )}
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="input pl-9 w-full"
                      placeholder="0.00"
                      value={priceOverride}
                      onChange={(e) => setPriceOverride(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-end">
                  <button className="btn" onClick={() => { setFoundCard(null); setSearchError(null); }}>
                    Back
                  </button>
                  <button className="btn-primary" onClick={confirmAdd}>
                    <Plus className="w-4 h-4" />
                    Add Card
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Tips */}
      <div className="card-panel">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Trade Tips</h3>
        </div>
        <p className="text-xs text-muted leading-relaxed">
          Market prices fluctuate — always check recent sales. A fair trade is within 5–10% of equal value.
          Consider card condition, rarity trends, and whether a card is rising or falling in price.
          Prices are pulled live from JustTCG and game-specific APIs — you can always adjust them manually.
        </p>
      </div>
    </div>
  );
}

function TradeSidePanel({
  label,
  cards,
  total,
  onAdd,
  onRemove,
  onPriceChange,
  color,
}: {
  label: string;
  cards: TradeCard[];
  total: number;
  onAdd: () => void;
  onRemove: (id: string) => void;
  onPriceChange: (id: string, price: number) => void;
  color: string;
}) {
  return (
    <div className="card-panel">
      <div className="flex items-center justify-between mb-4">
        <h2 className={`font-semibold ${color}`}>{label}</h2>
        <span className="text-sm font-bold">${total.toFixed(2)}</span>
      </div>
      {cards.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted">No cards added yet</div>
      ) : (
        <div className="space-y-2 mb-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-panel2 border border-border"
            >
              {card.imageUrl ? (
                <img src={card.imageUrl} alt={card.name} className="w-8 h-11 object-contain rounded shrink-0" />
              ) : (
                <div className="w-8 h-11 bg-panel border border-border rounded shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{card.name}</p>
                {card.setName && <p className="text-[10px] text-muted truncate">{card.setName}</p>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <DollarSign className="w-3 h-3 text-muted" />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="w-20 bg-panel border border-border rounded px-2 py-1 text-xs text-right"
                  value={card.marketPrice || ""}
                  placeholder="0.00"
                  onChange={(e) => onPriceChange(card.id, parseFloat(e.target.value) || 0)}
                />
              </div>
              <button onClick={() => onRemove(card.id)} className="text-muted hover:text-danger transition-colors shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="btn w-full justify-center" onClick={onAdd}>
        <Plus className="w-4 h-4" />
        Add Card
      </button>
    </div>
  );
}
