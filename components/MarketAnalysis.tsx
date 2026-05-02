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
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
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
          <option value="onepiece">One Piece</option>
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

          {/* Price history chart */}
          {result.priceHistory.length > 1 ? (
            <div className="p-3 rounded-xl bg-panel2 border border-border">
              <p className="text-[10px] text-muted uppercase tracking-wider font-medium mb-3">
                Price History
              </p>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={result.priceHistory} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#243049" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fill: "#9aa7bd" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#9aa7bd" }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => `$${v.toFixed(0)}`}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={{ background: "#121826", border: "1px solid #243049", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: "#9aa7bd" }}
                    labelFormatter={(d) => new Date(d).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    formatter={(v) => [`$${Number(v).toFixed(2)}`, "Price"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="price"
                    stroke="#7c9cff"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4, fill: "#7c9cff" }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : result.priceHistory.length <= 1 && result.currentPrice > 0 ? (
            <div className="p-3 rounded-xl bg-panel2 border border-border text-center">
              <p className="text-xs text-muted">
                Price history will build up here as you scan and look up this card over time.
              </p>
            </div>
          ) : null}

          {/* External links */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-panel2 border border-border">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-accent" />
              <span className="text-sm">View recent sales on TCGPlayer</span>
            </div>
            <a
              href={`https://www.tcgplayer.com/search/all/product?q=${encodeURIComponent(cardName)}`}
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
            Search for a card to see its current market price and buy/hold/sell signal
          </p>
          <p className="text-xs text-muted mt-1">
            Powered by JustTCG &mdash; price history charts coming soon
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
