export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";

interface MoverItem {
  fingerprint: string;
  name: string;
  game: string;
  currentPrice: number;
  change7dPct: number;
}

interface PriceRow {
  card_fingerprint: string;
  price_usd: number;
  recorded_at: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const auth = await requireAuth(req);

    const ninetyDaysAgo = new Date(
      Date.now() - 90 * 24 * 60 * 60 * 1000
    ).toISOString();

    const { data, error } = await auth.supabase
      .from("price_history")
      .select("card_fingerprint, price_usd, recorded_at")
      .eq("user_id", auth.user.id)
      .gte("recorded_at", ninetyDaysAgo)
      .order("recorded_at", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data || data.length === 0) {
      return NextResponse.json({ gainers: [], losers: [] });
    }

    // Group rows by card_fingerprint
    const grouped = new Map<string, PriceRow[]>();
    for (const row of data as PriceRow[]) {
      const rows = grouped.get(row.card_fingerprint) ?? [];
      rows.push(row);
      grouped.set(row.card_fingerprint, rows);
    }

    const now = Date.now();
    const ms7d = 7 * 24 * 60 * 60 * 1000;

    const movers: MoverItem[] = [];

    for (const [fingerprint, rows] of grouped) {
      // rows are sorted ascending by recorded_at (from the query)
      const current = Number(rows[rows.length - 1].price_usd);

      // Find the price closest to 7 days ago
      const targetTime = now - ms7d;
      let closestRow: PriceRow | null = null;
      let closestDiff = Infinity;

      for (const row of rows) {
        const rowTime = new Date(row.recorded_at).getTime();
        const diff = Math.abs(rowTime - targetTime);
        if (diff < closestDiff) {
          closestDiff = diff;
          closestRow = row;
        }
      }

      // Skip if the closest row is actually the most-recent price
      // (means we only have recent data, can't compute a meaningful 7d change)
      if (!closestRow) continue;
      const closestRowTime = new Date(closestRow.recorded_at).getTime();
      const mostRecentTime = new Date(rows[rows.length - 1].recorded_at).getTime();
      if (closestRowTime === mostRecentTime) continue;

      const old = Number(closestRow.price_usd);
      if (old === 0) continue;

      const change7dPct = ((current - old) / old) * 100;

      // Parse fingerprint: "game:name:setname"
      const parts = fingerprint.split(":");
      const game = parts[0] ?? "";
      const name = parts[1] ?? fingerprint;

      movers.push({ fingerprint, name, game, currentPrice: current, change7dPct });
    }

    // Sort descending by change7dPct
    movers.sort((a, b) => b.change7dPct - a.change7dPct);

    const gainers = movers.filter((m) => m.change7dPct > 0).slice(0, 3);
    const losers = movers
      .filter((m) => m.change7dPct < -1)
      .slice(-2)
      .reverse(); // bottom 2 (most negative), presented worst-first

    return NextResponse.json({ gainers, losers });
  } catch (err) {
    return authErrorResponse(err);
  }
}
