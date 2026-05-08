"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  X,
  ImageIcon,
  ExternalLink,
  Loader2,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ScannedCard, GAME_LABELS } from "@/lib/types";
import type { PriceTrend } from "@/lib/priceHistory";

interface Props {
  card: ScannedCard & { batchName?: string; batchId?: string };
  onClose: () => void;
}

function ChangeBadge({ pct, label }: { pct: number; label: string }) {
  const positive = pct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
        positive
          ? "bg-green-500/15 text-green-400"
          : "bg-red-500/15 text-danger"
      }`}
    >
      {positive ? "+" : ""}
      {pct.toFixed(1)}% {label}
    </span>
  );
}

export default function CardDetailModal({ card, onClose }: Props) {
  const [trend, setTrend] = useState<PriceTrend | null | undefined>(undefined); // undefined = loading

  // Fetch price history on mount
  useEffect(() => {
    if (!card.game || !card.name) {
      setTrend(null);
      return;
    }

    const params = new URLSearchParams({
      game: card.game,
      name: card.name,
      ...(card.setName ? { setName: card.setName } : {}),
    });

    fetch(`/api/price-history?${params.toString()}`)
      .then((res) => res.json())
      .then((data) => setTrend(data.trend ?? null))
      .catch(() => setTrend(null));
  }, [card.game, card.name, card.setName]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose();
  };

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const imageUrl = card.imageUrl ?? card.uploadedImageDataUrl ?? card.photos?.[0]?.dataUrl;

  const hasHistory = trend && trend.history.length >= 2;

  // Format chart data with shorter date labels
  const chartData = hasHistory
    ? trend.history.map((point) => ({
        date: new Date(point.date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        price: point.price,
      }))
    : [];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-panel border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="text-xl font-bold text-white truncate pr-4">{card.name}</h2>
          <button
            onClick={onClose}
            className="shrink-0 p-1.5 rounded-lg text-muted hover:text-white hover:bg-panel2 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col sm:flex-row gap-6">
          {/* Left column — card image + metadata */}
          <div className="sm:w-1/3 flex flex-col gap-3">
            {/* Card image */}
            <div className="aspect-[2.5/3.5] rounded-xl overflow-hidden bg-panel2 border border-border flex items-center justify-center">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={card.name}
                  className="w-full h-full object-contain"
                />
              ) : (
                <ImageIcon className="w-12 h-12 text-muted" />
              )}
            </div>

            {/* Metadata pills */}
            <div className="flex flex-col gap-2 text-sm">
              {card.setName && (
                <div className="text-muted">
                  <span className="font-medium text-white">{card.setName}</span>
                  {card.collectorNumber && (
                    <span className="ml-1 text-muted">#{card.collectorNumber}</span>
                  )}
                </div>
              )}

              {/* Game badge */}
              <span className="inline-flex w-fit items-center rounded-full bg-panel2 border border-border px-2.5 py-0.5 text-xs font-medium text-muted">
                {GAME_LABELS[card.game] ?? card.game}
              </span>

              {/* Condition badge */}
              <span className="inline-flex w-fit items-center rounded-full bg-panel2 border border-border px-2.5 py-0.5 text-xs font-medium text-white">
                {card.condition}
              </span>

              {/* Foil badge */}
              {card.foil && (
                <span className="inline-flex w-fit items-center rounded-full bg-yellow-500/15 border border-yellow-500/30 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                  Foil
                </span>
              )}

              {/* Graded / slabbed badge */}
              {card.slabbed && card.grading && (
                <span className="inline-flex w-fit items-center rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                  {card.grading.company.toUpperCase()} {card.grading.grade}
                </span>
              )}
            </div>
          </div>

          {/* Right column — price + details */}
          <div className="sm:w-2/3 flex flex-col gap-5">
            {/* Market price */}
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-1">Market Price</p>
              <p className="text-4xl font-bold text-accent">
                {card.marketPriceUsd != null
                  ? `$${card.marketPriceUsd.toFixed(2)}`
                  : <span className="text-muted text-2xl">—</span>}
              </p>
            </div>

            {/* Batch link */}
            {card.batchName && card.batchId && (
              <div className="text-sm">
                <span className="text-muted">In batch: </span>
                <Link
                  href={`/scan?batch=${card.batchId}`}
                  className="text-accent hover:underline font-medium"
                >
                  {card.batchName}
                </Link>
              </div>
            )}

            {/* eBay listing link */}
            {card.ebayListingId && (
              <a
                href={`https://www.ebay.com/itm/${card.ebayListingId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline w-fit"
              >
                View on eBay
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {/* Price History section */}
            <div>
              <p className="text-xs text-muted uppercase tracking-wider mb-3">Price History</p>

              {trend === undefined && (
                <div className="flex items-center gap-2 text-muted text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading…
                </div>
              )}

              {trend === null && (
                <p className="text-sm text-muted">
                  Price tracked since first scan — check back after more lookups.
                </p>
              )}

              {hasHistory && (
                <div className="flex flex-col gap-3">
                  {/* Change badges */}
                  <div className="flex flex-wrap gap-2">
                    <ChangeBadge pct={trend.change7dPct} label="7d" />
                    <ChangeBadge pct={trend.change30dPct} label="30d" />
                  </div>

                  {/* Line chart */}
                  <div className="h-32 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={chartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <XAxis
                          dataKey="date"
                          tick={{ fill: "#9ca3af", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          tick={{ fill: "#9ca3af", fontSize: 10 }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "var(--color-panel2, #1e1e2e)",
                            border: "1px solid var(--color-border, #2d2d3d)",
                            borderRadius: "8px",
                            fontSize: "12px",
                          }}
                          labelStyle={{ color: "#9ca3af" }}
                          itemStyle={{ color: "#7c6ef3" }}
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(value: any) => [
                            value != null ? `$${Number(value).toFixed(2)}` : "—",
                            "Price" as any,
                          ]}
                        />
                        <Line
                          type="monotone"
                          dataKey="price"
                          stroke="#7c6ef3"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4, fill: "#7c6ef3" }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
