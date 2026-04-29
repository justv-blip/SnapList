"use client";

import { useState } from "react";
import {
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  ExternalLink,
  BarChart3,
  DollarSign,
  AlertCircle,
  ArrowRight,
} from "lucide-react";
import type { MarketAnalysis, MarketSignal, TrendDirection } from "@/lib/marketAnalysis";

const SIGNAL_META: Record<MarketSignal, { label: string; color: string; bg: string }> = {
  buy: { label: "Buy", color: "text-accent2", bg: "bg-accent2/10 border-accent2/30" },
  hold: { label: "Hold", color: "text-accent", bg: "bg-accent/10 border-accent/30" },
  sell: { label: "Sell", color: "text-danger", bg: "bg-danger/10 border-danger/30" },
};

const TREND_ICON: Record<TrendDirection, typeof TrendingUp> = {
  up: TrendingUp,
  down: TrendingDown,
  stable: Minus,
};

interface MarketAnalysisPanelProps {
  /** If provided, auto-search on mount */
  initialCardName?: string;
  initialGame?: string;
}

export function MarketAnalysisPanel({
  initialCardName,
  initialGame,
}: MarketAnalysisPanelProps) {
  const [cardName, setCardName] = useState(initialCardName || "");
  const [game, setGame] = useState(initialGame || "pokemon");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MarketAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!cardName.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/market-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardName: cardName.trim(), game }),
      });
      if (!res.ok) throw new Error("Failed to fetch analysis");
      const data: MarketAnalysis = await res.json();
      setResult(data);
    } catch {
      setError("Could not fetch market data. Try again later.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
          <input
            className="input pl-9 w-full"
            placeholder="Card name (e.g. Charizard ex)"
            value={cardName}
            onChange={(e) => setCardName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
        </div>
        <select
          className="input text-sm w-32"
          value={game}
          onChange={(e) => setGame(e.target.value)}
        >
          <option value="pokemon">Pokémon</option>
          <option value="mtg">Magic</option>
          <option value="yugioh">Yu-Gi-Oh!</option>
          <option value="lorcana">Lorcana</option>
          <option value="one-piece">One Piece</option>
        </select>
        <button
          className="btn-primary text-sm"
          onClick={handleSearch}
          disabled={loading || !cardName.trim()}
        >
          {loading ? "Analyzing..." : "Analyze"}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-4">
          {/* Signal banner */}
          <div className={`p-4 rounded-xl border ${SIGNAL_META[result.signal].bg}`}>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-panel border border-border flex items-center justify-center shrink-0">
                <BarChart3 className={`w-6 h-6 ${SIGNAL_META[result.signal].color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold ${SIGNAL_META[result.signal].color}`}>
                    {SIGNAL_META[result.signal].label}
                  </span>
                  {result.signalConfidence > 0 && (
                    <span className="text-[10px] text-muted">
                      {Math.round(result.signalConfidence * 100)}% confidence
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted mt-0.5">{result.signalReasoning}</p>
              </div>
            </div>
          </div>

          {/* Price stats */}
          {result.currentPrice > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <PriceStat label="Current" value={`$${result.currentPrice.toFixed(2)}`} />
              <PriceStat label="30-Day Avg" value={`$${result.averagePrice30d.toFixed(2)}`} />
              <PriceStat
                label="7-Day Change"
                value={`${result.priceChange7dPercent >= 0 ? "+" : ""}${result.priceChange7dPercent.toFixed(1)}%`}
                trend={result.trend7d}
              />
              <PriceStat
                label="30-Day Change"
                value={`${result.priceChange30dPercent >= 0 ? "+" : ""}${result.priceChange30dPercent.toFixed(1)}%`}
                trend={result.trend30d}
              />
            </div>
          )}

          {/* MyCollectibles link */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-panel2 border border-border">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-accent" />
              <span className="text-sm">View full price history on MyCollectibles.com</span>
            </div>
            <a
              href={`https://www.mycollectibles.com/search?q=${encodeURIComponent(cardName)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn text-xs"
            >
              Visit
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!result && !loading && !error && (
        <div className="text-center py-8">
          <BarChart3 className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">
            Search for a card to see price trends and buy/hold/sell analysis
          </p>
          <p className="text-xs text-muted mt-1">
            Powered by market data from MyCollectibles.com
          </p>
        </div>
      )}
    </div>
  );
}

function PriceStat({
  label,
  value,
  trend,
}: {
  label: string;
  value: string;
  trend?: TrendDirection;
}) {
  const TrendIcon = trend ? TREND_ICON[trend] : null;
  const trendColor = trend === "up" ? "text-accent2" : trend === "down" ? "text-danger" : "text-muted";

  return (
    <div className="p-3 rounded-lg bg-panel2 border border-border">
      <p className="text-[10px] text-muted uppercase tracking-wider font-medium">{label}</p>
      <div className="flex items-center gap-1.5 mt-1">
        <span className="text-sm font-bold">{value}</span>
        {TrendIcon && <TrendIcon className={`w-3.5 h-3.5 ${trendColor}`} />}
      </div>
    </div>
  );
}
