"use client";

import { useState, useCallback } from "react";
import {
  RefreshCcw,
  DollarSign,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Minus,
} from "lucide-react";
import type { EnrichedListing } from "@/app/api/ebay/reprice/route";

interface RowState {
  selected: boolean;
  newPrice: string;
  result?: { success: boolean; error?: string };
}

function priceDiff(current: number, suggested?: number) {
  if (!suggested || current === 0) return null;
  const pct = ((suggested - current) / current) * 100;
  return pct;
}

export function EbayRepricingTool() {
  const [listings, setListings] = useState<EnrichedListing[]>([]);
  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [loading, setLoading] = useState(false);
  const [repricing, setRepricing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    setDone(false);

    try {
      const res = await fetch("/api/ebay/reprice");
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to load listings");
      }
      const data = await res.json();
      const fetched: EnrichedListing[] = data.listings || [];
      setListings(fetched);

      // Pre-fill each row with suggested price (or current if no suggestion)
      const initial: Record<string, RowState> = {};
      for (const l of fetched) {
        initial[l.offerId] = {
          selected: !!l.suggestedPrice,
          newPrice: (l.suggestedPrice ?? l.currentPrice).toFixed(2),
          result: undefined,
        };
      }
      setRows(initial);
    } catch (err: any) {
      setError(err.message || "Failed to load listings");
    } finally {
      setLoading(false);
    }
  }, []);

  const toggleAll = (checked: boolean) => {
    setRows((prev) => {
      const next = { ...prev };
      for (const id in next) next[id] = { ...next[id], selected: checked };
      return next;
    });
  };

  const toggleRow = (offerId: string) => {
    setRows((prev) => ({
      ...prev,
      [offerId]: { ...prev[offerId], selected: !prev[offerId].selected },
    }));
  };

  const setPrice = (offerId: string, val: string) => {
    setRows((prev) => ({
      ...prev,
      [offerId]: { ...prev[offerId], newPrice: val },
    }));
  };

  const selectedCount = Object.values(rows).filter((r) => r.selected).length;

  const handleReprice = async () => {
    const updates = listings
      .filter((l) => rows[l.offerId]?.selected)
      .map((l) => ({
        offerId: l.offerId,
        newPrice: parseFloat(rows[l.offerId].newPrice),
      }))
      .filter((u) => !isNaN(u.newPrice) && u.newPrice > 0);

    if (updates.length === 0) return;

    setRepricing(true);
    setError(null);

    try {
      const res = await fetch("/api/ebay/reprice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      const data = await res.json();
      const resultMap: Record<string, { success: boolean; error?: string }> = {};
      for (const r of data.results || []) {
        resultMap[r.offerId] = { success: r.success, error: r.error };
      }
      setRows((prev) => {
        const next = { ...prev };
        for (const id in resultMap) {
          if (next[id]) next[id] = { ...next[id], result: resultMap[id] };
        }
        return next;
      });
      setDone(true);
    } catch (err: any) {
      setError(err.message || "Repricing failed");
    } finally {
      setRepricing(false);
    }
  };

  const allSelected =
    listings.length > 0 && Object.values(rows).every((r) => r.selected);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold text-sm">eBay Repricing Tool</h3>
          <p className="text-xs text-muted mt-0.5">
            Load your active eBay listings and reprice them against live market
            data — one click.
          </p>
        </div>
        <button
          className="btn-primary text-sm flex items-center gap-2"
          onClick={loadListings}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCcw className="w-4 h-4" />
          )}
          {loading ? "Loading…" : listings.length > 0 ? "Refresh" : "Load Listings"}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 text-sm text-danger">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Empty state */}
      {!loading && listings.length === 0 && !error && (
        <div className="text-center py-10">
          <DollarSign className="w-8 h-8 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">
            Load your active eBay listings to get started
          </p>
          <p className="text-xs text-muted mt-1">
            Up to 20 listings will be enriched with live market prices
          </p>
        </div>
      )}

      {/* Listings table */}
      {listings.length > 0 && (
        <>
          {/* Done banner */}
          {done && (
            <div className="flex items-center gap-2 text-sm text-accent2 bg-accent2/10 border border-accent2/20 rounded-lg px-3 py-2">
              <CheckCircle2 className="w-4 h-4" />
              Repricing complete —{" "}
              {
                Object.values(rows).filter((r) => r.result?.success).length
              }{" "}
              listing(s) updated successfully.
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-panel2">
                  <th className="w-10 px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                      className="accent-accent"
                    />
                  </th>
                  <th className="text-left px-3 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">
                    Listing
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                    Current
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                    Market
                  </th>
                  <th className="text-right px-3 py-2.5 text-xs font-medium text-muted uppercase tracking-wider whitespace-nowrap">
                    New Price
                  </th>
                  <th className="w-8 px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {listings.map((listing) => {
                  const row = rows[listing.offerId];
                  if (!row) return null;
                  const diff = priceDiff(
                    listing.currentPrice,
                    listing.suggestedPrice
                  );
                  const DiffIcon =
                    diff === null
                      ? null
                      : diff > 0.5
                      ? TrendingUp
                      : diff < -0.5
                      ? TrendingDown
                      : Minus;
                  const diffColor =
                    diff === null
                      ? ""
                      : diff > 0.5
                      ? "text-accent2"
                      : diff < -0.5
                      ? "text-danger"
                      : "text-muted";

                  return (
                    <tr
                      key={listing.offerId}
                      className={`transition-colors ${
                        row.selected
                          ? "bg-accent/5"
                          : "bg-panel hover:bg-panel2"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={() => toggleRow(listing.offerId)}
                          className="accent-accent"
                        />
                      </td>

                      {/* Title */}
                      <td className="px-3 py-2.5 max-w-[220px]">
                        <p className="font-medium truncate text-xs leading-snug">
                          {listing.title}
                        </p>
                        {listing.setName && (
                          <p className="text-[10px] text-muted truncate">
                            {listing.setName}
                          </p>
                        )}
                        <p className="text-[10px] text-muted">
                          Qty: {listing.quantity}
                        </p>
                      </td>

                      {/* Current price */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        <span className="text-xs font-medium">
                          ${listing.currentPrice.toFixed(2)}
                        </span>
                      </td>

                      {/* Market price + diff */}
                      <td className="px-3 py-2.5 text-right whitespace-nowrap">
                        {listing.marketPrice ? (
                          <div className="flex items-center justify-end gap-1">
                            <span className="text-xs font-medium">
                              ${listing.marketPrice.toFixed(2)}
                            </span>
                            {DiffIcon && diff !== null && (
                              <span
                                className={`text-[10px] flex items-center gap-0.5 ${diffColor}`}
                              >
                                <DiffIcon className="w-3 h-3" />
                                {Math.abs(diff).toFixed(0)}%
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-muted">—</span>
                        )}
                      </td>

                      {/* Editable price */}
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <span className="text-xs text-muted">$</span>
                          <input
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={row.newPrice}
                            onChange={(e) =>
                              setPrice(listing.offerId, e.target.value)
                            }
                            className="input text-xs text-right w-20 py-1 px-2"
                          />
                        </div>
                      </td>

                      {/* Result status */}
                      <td className="px-3 py-2.5 text-center">
                        {row.result?.success && (
                          <CheckCircle2 className="w-4 h-4 text-accent2 mx-auto" />
                        )}
                        {row.result && !row.result.success && (
                          <span title={row.result.error}>
                            <XCircle className="w-4 h-4 text-danger mx-auto" />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer actions */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-xs text-muted">
              {selectedCount} of {listings.length} listing
              {listings.length !== 1 ? "s" : ""} selected
            </p>
            <button
              className="btn-primary text-sm flex items-center gap-2"
              onClick={handleReprice}
              disabled={repricing || selectedCount === 0}
            >
              {repricing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronRight className="w-4 h-4" />
              )}
              {repricing
                ? "Repricing…"
                : `Reprice ${selectedCount > 0 ? selectedCount : ""} Selected`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
