"use client";

import { useState, useMemo, useCallback } from "react";
import {
  ArrowLeftRight,
  Plus,
  Trash2,
  Search,
  TrendingUp,
  TrendingDown,
  Equal,
  AlertTriangle,
  DollarSign,
  CheckCircle2,
} from "lucide-react";

interface TradeCard {
  id: string;
  name: string;
  game: string;
  setName?: string;
  marketPrice: number;
  imageUrl?: string;
}

type TradeSide = "giving" | "receiving";

function uuid() {
  return crypto.randomUUID();
}

export default function TradeAnalyzerPage() {
  const [giving, setGiving] = useState<TradeCard[]>([]);
  const [receiving, setReceiving] = useState<TradeCard[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [addingSide, setAddingSide] = useState<TradeSide | null>(null);

  const givingTotal = useMemo(() => giving.reduce((sum, c) => sum + c.marketPrice, 0), [giving]);
  const receivingTotal = useMemo(() => receiving.reduce((sum, c) => sum + c.marketPrice, 0), [receiving]);
  const difference = receivingTotal - givingTotal;
  const percentDiff = givingTotal > 0 ? ((difference / givingTotal) * 100) : 0;

  const addCard = useCallback(
    (side: TradeSide) => {
      setAddingSide(side);
      setSearchQuery("");
    },
    []
  );

  const submitCard = useCallback(() => {
    if (!searchQuery.trim() || !addingSide) return;
    const card: TradeCard = {
      id: uuid(),
      name: searchQuery.trim(),
      game: "pokemon",
      marketPrice: 0,
    };
    if (addingSide === "giving") {
      setGiving((prev) => [...prev, card]);
    } else {
      setReceiving((prev) => [...prev, card]);
    }
    setAddingSide(null);
    setSearchQuery("");
  }, [searchQuery, addingSide]);

  const updatePrice = useCallback(
    (side: TradeSide, id: string, price: number) => {
      const setter = side === "giving" ? setGiving : setReceiving;
      setter((prev) => prev.map((c) => (c.id === id ? { ...c, marketPrice: price } : c)));
    },
    []
  );

  const removeCard = useCallback(
    (side: TradeSide, id: string) => {
      const setter = side === "giving" ? setGiving : setReceiving;
      setter((prev) => prev.filter((c) => c.id !== id));
    },
    []
  );

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
        {/* Giving side */}
        <TradeSidePanel
          label="You Give"
          cards={giving}
          total={givingTotal}
          onAdd={() => addCard("giving")}
          onRemove={(id) => removeCard("giving", id)}
          onPriceChange={(id, p) => updatePrice("giving", id, p)}
          color="text-danger"
        />

        {/* Receiving side */}
        <TradeSidePanel
          label="You Receive"
          cards={receiving}
          total={receivingTotal}
          onAdd={() => addCard("receiving")}
          onRemove={(id) => removeCard("receiving", id)}
          onPriceChange={(id, p) => updatePrice("receiving", id, p)}
          color="text-accent2"
        />
      </div>

      {/* Add card dialog */}
      {addingSide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card-panel max-w-sm w-full mx-4 p-6 space-y-4">
            <h3 className="font-semibold">
              Add card to &ldquo;{addingSide === "giving" ? "You Give" : "You Receive"}&rdquo;
            </h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
              <input
                className="input pl-9"
                placeholder="Card name..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && submitCard()}
              />
            </div>
            <p className="text-xs text-muted">
              Enter a card name and set the market price manually. Future updates will auto-lookup prices.
            </p>
            <div className="flex gap-3 justify-end">
              <button className="btn" onClick={() => setAddingSide(null)}>Cancel</button>
              <button className="btn-primary" onClick={submitCard} disabled={!searchQuery.trim()}>
                Add Card
              </button>
            </div>
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
          SnapList will automatically pull market prices in a future update.
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
        <div className="text-center py-8 text-sm text-muted">
          No cards added yet
        </div>
      ) : (
        <div className="space-y-2 mb-4">
          {cards.map((card) => (
            <div
              key={card.id}
              className="flex items-center gap-3 p-2 rounded-lg bg-panel2 border border-border"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{card.name}</p>
              </div>
              <div className="flex items-center gap-1">
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
              <button
                onClick={() => onRemove(card.id)}
                className="text-muted hover:text-danger transition-colors"
              >
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
