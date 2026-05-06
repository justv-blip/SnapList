"use client";

import { useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp, TrendingDown, Minus, BarChart2 } from "lucide-react";

export interface PortfolioSnapshot {
  total_value_usd: number;
  card_count: number;
  sealed_count: number;
  recorded_at: string;
}

interface Props {
  snapshots: PortfolioSnapshot[];
  currentValue: number; // live total (cards + sealed) for the headline
  cardCount: number;
  sealedCount: number;
}

type Period = "7d" | "30d" | "all";

function formatDollar(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}k`;
  return `$${v.toFixed(0)}`;
}

export function PortfolioChart({ snapshots, currentValue, cardCount, sealedCount }: Props) {
  const [period, setPeriod] = useState<Period>("30d");

  // Filter snapshots to selected period
  const now = Date.now();
  const periodMs: Record<Period, number> = {
    "7d":  7  * 86_400_000,
    "30d": 30 * 86_400_000,
    "all": Infinity,
  };

  const filtered = snapshots.filter(
    (s) => now - new Date(s.recorded_at).getTime() <= periodMs[period]
  );

  // Need at least 2 points to draw a meaningful chart
  const hasHistory = filtered.length >= 2;

  const chartData = filtered.map((s) => ({
    label: new Date(s.recorded_at).toLocaleDateString("en-US", {
      month: "short",
      day:   "numeric",
    }),
    value:  Number(s.total_value_usd),
    cards:  s.card_count,
    sealed: s.sealed_count,
  }));

  // Trend vs start of period
  const firstValue = chartData[0]?.value ?? 0;
  const lastValue  = chartData[chartData.length - 1]?.value ?? currentValue;
  const changePct  = firstValue > 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;
  const isUp   = changePct > 0.5;
  const isDown = changePct < -0.5;

  return (
    <div className="card-panel p-5">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] text-muted uppercase tracking-wider font-medium">
            Portfolio Value
          </p>
          <p className="text-3xl font-bold mt-1 tabular-nums">
            ${currentValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {hasHistory && (
              <div className={`flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full border ${
                isUp
                  ? "text-green-400 bg-green-500/10 border-green-500/20"
                  : isDown
                  ? "text-red-400 bg-red-500/10 border-red-500/20"
                  : "text-muted bg-surface-2 border-border"
              }`}>
                {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                {changePct >= 0 ? "+" : ""}{changePct.toFixed(1)}%
              </div>
            )}
            <span className="text-xs text-muted">
              {cardCount} card{cardCount !== 1 ? "s" : ""}
              {sealedCount > 0 && ` · ${sealedCount} sealed`}
            </span>
          </div>
        </div>

        {/* Period selector */}
        <div className="flex gap-1 shrink-0">
          {(["7d", "30d", "all"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                period === p
                  ? "bg-accent text-black"
                  : "text-muted hover:text-foreground hover:bg-panel2"
              }`}
            >
              {p === "all" ? "All" : p.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Chart or empty state */}
      {hasHistory ? (
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="portfolioGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor="#7c6ef3" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#7c6ef3" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "#666" }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: "#666" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatDollar}
              width={42}
            />
            <Tooltip
              contentStyle={{
                background:   "#14141f",
                border:       "1px solid rgba(255,255,255,0.08)",
                borderRadius: "10px",
                fontSize:     "12px",
                boxShadow:    "0 4px 24px rgba(0,0,0,0.4)",
              }}
              formatter={(v) => [`$${Number(v).toFixed(2)}`, "Value"]}
              labelStyle={{ color: "#999", marginBottom: "4px" }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#7c6ef3"
              strokeWidth={2}
              fill="url(#portfolioGrad)"
              dot={false}
              activeDot={{ r: 4, fill: "#7c6ef3" }}
            />
          </AreaChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart2 className="w-7 h-7 text-muted/40 mb-2" />
          <p className="text-xs text-muted">
            {snapshots.length < 2
              ? "Keep scanning to build your portfolio history"
              : "Not enough data for this period — try a longer range"}
          </p>
        </div>
      )}
    </div>
  );
}
