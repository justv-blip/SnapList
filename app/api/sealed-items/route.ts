// POST /api/sealed-items  — save a scan result to the user's sealed collection
// GET  /api/sealed-items  — list the user's sealed items (newest first)

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import type { SealedScanResult } from "@/lib/types";

export const runtime = "nodejs";

// ── POST ─────────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  let body: SealedScanResult;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { guess, marketPriceUsd, priceSource, priceSampleSize, condition } = body;

  const { data, error } = await auth.supabase
    .from("sealed_items")
    .insert({
      user_id:           auth.user.id,
      product_name:      guess.productName ?? null,
      game:              guess.game ?? null,
      product_type:      guess.productType ?? null,
      set_name:          guess.setName ?? null,
      language:          guess.language ?? null,
      edition:           guess.edition ?? null,
      confidence:        guess.confidence,
      reasoning:         guess.reasoning,
      market_price_usd:  marketPriceUsd ?? null,
      price_source:      priceSource ?? null,
      price_sample_size: priceSampleSize ?? null,
      condition:         condition ?? "sealed",
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 201 });
}

// ── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const url = new URL(req.url);
  const limit  = Math.min(parseInt(url.searchParams.get("limit")  ?? "50", 10), 200);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  const { data, error } = await auth.supabase
    .from("sealed_items")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data });
}
