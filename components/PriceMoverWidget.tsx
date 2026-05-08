"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown, Zap } from "lucide-react";

interface MoverItem {
  fingerprint: string;
  name: string;
  game: string;
  currentPrice: number;
  change7dPct: number;
}

interface PriceMovers {
  gainers: MoverItem[];
  losers: MoverItem[];
}

export default function PriceMoverWidget() {
  const [movers, setMovers] = useState<PriceMovers | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/price-movers")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMovers(d ?? null))
      .catch(() => setMovers(null))
      .finally(() => setLoading(false));
  }, []);

  const hasData = movers && (movers.gainers.length > 0 || movers.losers.length > 0);

  if (loading || !hasData) return null; // silently hide if no data yet

  const allMovers = [
    ...movers.gainers.map((m) => ({ ...m, dir: "up" as const })),
    ...movers.losers.map((m) => ({ ...m, dir: "down" as const })),
  ];

  return (
    <div className="card-panel">
      <div className="flex items-center gap-2 mb-3">
        <Zap className="w-4 h-4 text-accent" />
        <h3 className="font-semibold text-sm">Price Movers</h3>
        <span className="text-xs text-muted ml-1">7-day change</span>
        <span className="ml-auto text-[10px] text-muted">From your scan history</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {allMovers.map((m) => (
          <div
            key={m.fingerprint}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs ${
              m.dir === "up"
                ? "bg-green-500/8 border-green-500/20"
                : "bg-red-500/8 border-red-500/20"
            }`}
          >
            {m.dir === "up" ? (
              <TrendingUp className="w-3.5 h-3.5 text-green-400 shrink-0" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-red-400 shrink-0" />
            )}
            <span className="font-medium text-foreground truncate max-w-[120px]">{m.name}</span>
            <span className={`font-bold shrink-0 ${m.dir === "up" ? "text-green-400" : "text-red-400"}`}>
              {m.change7dPct >= 0 ? "+" : ""}{m.change7dPct.toFixed(1)}%
            </span>
            <span className="text-muted shrink-0">${m.currentPrice.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
