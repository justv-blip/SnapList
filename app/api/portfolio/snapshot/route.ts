// POST /api/portfolio/snapshot — record total portfolio value
// GET  /api/portfolio/snapshot — retrieve time-series (last N days)
//
// Deduplication: POST is a no-op if the user already has a snapshot
// within the last hour whose value differs by less than 0.5%.

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

const DEDUP_WINDOW_MS   = 60 * 60 * 1000; // 1 hour
const VALUE_TOLERANCE   = 0.005;           // 0.5% price change threshold

// ── POST ────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  let body: { totalValueUsd: number; cardCount?: number; sealedCount?: number };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { totalValueUsd, cardCount = 0, sealedCount = 0 } = body;
  if (typeof totalValueUsd !== "number" || isNaN(totalValueUsd)) {
    return NextResponse.json({ error: "totalValueUsd must be a number" }, { status: 400 });
  }

  // Dedup: skip if recent snapshot exists with a similar value
  const dedupCutoff = new Date(Date.now() - DEDUP_WINDOW_MS).toISOString();
  const { data: recent } = await auth.supabase
    .from("portfolio_snapshots")
    .select("total_value_usd")
    .eq("user_id", auth.user.id)
    .gte("recorded_at", dedupCutoff)
    .order("recorded_at", { ascending: false })
    .limit(1)
    .single();

  if (recent) {
    const lastValue = Number(recent.total_value_usd);
    if (lastValue > 0) {
      const diff = Math.abs(totalValueUsd - lastValue) / lastValue;
      if (diff <= VALUE_TOLERANCE) {
        return NextResponse.json({ skipped: true });
      }
    } else if (totalValueUsd === 0) {
      return NextResponse.json({ skipped: true });
    }
  }

  const { error } = await auth.supabase.from("portfolio_snapshots").insert({
    user_id:         auth.user.id,
    total_value_usd: totalValueUsd,
    card_count:      cardCount,
    sealed_count:    sealedCount,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const url  = new URL(req.url);
  const days = Math.min(parseInt(url.searchParams.get("days") ?? "60", 10), 365);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await auth.supabase
    .from("portfolio_snapshots")
    .select("total_value_usd, card_count, sealed_count, recorded_at")
    .eq("user_id", auth.user.id)
    .gte("recorded_at", since)
    .order("recorded_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ snapshots: data ?? [] });
}
