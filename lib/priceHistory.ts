/**
 * Price history helpers — record price observations and query trends.
 * All operations are best-effort: errors are swallowed so they never
 * interrupt the main scan / lookup flow.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ── Fingerprint ──────────────────────────────────────────────────────────────

/**
 * Build a stable, normalised fingerprint for a card.
 * Used as the primary key for price history lookups.
 */
export function makeFingerprint(
  game: string,
  name: string,
  setName?: string | null
): string {
  const g = game.toLowerCase().trim();
  const n = name.toLowerCase().trim();
  const s = (setName || "").toLowerCase().trim();
  return `${g}:${n}:${s}`;
}

// ── Record ───────────────────────────────────────────────────────────────────

interface RecordPriceInput {
  game: string;
  name: string;
  setName?: string | null;
  priceUsd: number;
  source: "scan" | "lookup" | "market-analysis";
}

/**
 * Insert a single price observation. Never throws — errors are logged only.
 */
export async function recordPrice(
  supabase: SupabaseClient,
  userId: string,
  input: RecordPriceInput
): Promise<void> {
  if (!input.priceUsd || input.priceUsd <= 0) return;

  try {
    const { error } = await supabase.from("price_history").insert({
      user_id: userId,
      card_fingerprint: makeFingerprint(input.game, input.name, input.setName),
      game: input.game,
      card_name: input.name,
      set_name: input.setName || null,
      price_usd: input.priceUsd,
      source: input.source,
    });
    if (error) console.warn("[price_history] insert error:", error.message);
  } catch (err: any) {
    console.warn("[price_history] unexpected error:", err?.message);
  }
}

// ── Query ────────────────────────────────────────────────────────────────────

export interface PricePoint {
  date: string;   // ISO date string
  price: number;  // USD
}

export interface PriceTrend {
  history: PricePoint[];          // Sorted oldest → newest (up to 90 days)
  avg7d: number | null;
  avg30d: number | null;
  avg90d: number | null;
  change7dPct: number;
  change30dPct: number;
}

/**
 * Fetch price history for a card and compute trend metrics.
 * Returns null if no history exists.
 */
export async function getPriceTrend(
  supabase: SupabaseClient,
  userId: string,
  game: string,
  name: string,
  setName?: string | null
): Promise<PriceTrend | null> {
  try {
    const fingerprint = makeFingerprint(game, name, setName);
    const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();

    const { data, error } = await supabase
      .from("price_history")
      .select("price_usd, recorded_at")
      .eq("user_id", userId)
      .eq("card_fingerprint", fingerprint)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true });

    if (error || !data || data.length === 0) return null;

    const now = Date.now();
    const msIn7d = 7 * 24 * 60 * 60 * 1000;
    const msIn30d = 30 * 24 * 60 * 60 * 1000;

    const rows7d = data.filter((r) => now - new Date(r.recorded_at).getTime() <= msIn7d);
    const rows30d = data.filter((r) => now - new Date(r.recorded_at).getTime() <= msIn30d);

    const avg = (rows: typeof data) =>
      rows.length > 0
        ? rows.reduce((s, r) => s + Number(r.price_usd), 0) / rows.length
        : null;

    const avg7d = avg(rows7d);
    const avg30d = avg(rows30d);
    const avg90d = avg(data);

    const history: PricePoint[] = data.map((r) => ({
      date: r.recorded_at,
      price: Number(r.price_usd),
    }));

    // Current price is the most recent observation
    const current = history[history.length - 1]?.price ?? 0;

    const changePct = (avg: number | null) =>
      avg && avg > 0 ? ((current - avg) / avg) * 100 : 0;

    return {
      history,
      avg7d,
      avg30d,
      avg90d,
      change7dPct: changePct(avg7d),
      change30dPct: changePct(avg30d),
    };
  } catch (err: any) {
    console.warn("[price_history] query error:", err?.message);
    return null;
  }
}
