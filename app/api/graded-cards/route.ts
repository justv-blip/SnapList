// POST /api/graded-cards
// Saves a single graded (slabbed) card directly to the user's collection.
// Creates or reuses a special "Graded Cards" batch for the user.
//
// Body: { card: ScannedCard }

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { v4 as uuid } from "uuid";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const card = body.card as Record<string, unknown> | undefined;
  if (!card || typeof card.name !== "string" || !card.name) {
    return NextResponse.json({ error: "card.name is required" }, { status: 400 });
  }

  const { supabase, user } = auth;

  // ── Find or create the "Graded Cards" batch ──────────────────────────────────
  const { data: existingBatch } = await supabase
    .from("batches")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", "Graded Cards")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let batchId: string;

  if (existingBatch?.id) {
    batchId = existingBatch.id;
  } else {
    const newBatchId = uuid();
    const { error: batchErr } = await supabase.from("batches").insert({
      id:         newBatchId,
      user_id:    user.id,
      name:       "Graded Cards",
      status:     "ready",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (batchErr) {
      return NextResponse.json({ error: batchErr.message }, { status: 500 });
    }
    batchId = newBatchId;
  }

  // ── Insert the card ───────────────────────────────────────────────────────────
  const cardId = (card.id as string) || uuid();

  const { error: cardErr } = await supabase.from("cards").insert({
    id:                       cardId,
    batch_id:                 batchId,
    user_id:                  user.id,
    game:                     card.game || "other",
    name:                     card.name,
    set_name:                 card.setName || null,
    set_code:                 card.setCode || null,
    collector_number:         card.collectorNumber || null,
    rarity:                   card.rarity || null,
    image_url:                card.imageUrl || null,
    market_price_usd:         card.marketPriceUsd ?? null,
    condition:                card.condition || "Near Mint",
    quantity:                 card.quantity || 1,
    foil:                     card.foil || false,
    language:                 card.language || "English",
    notes:                    card.notes || null,
    identification_source:    "verified",
    identification_confidence: 1.0,
    external_url:             card.externalUrl || null,
    listing_title:            card.listingTitle || null,
    listing_description:      card.listingDescription || null,
    sku:                      card.sku || null,
    // Grading
    slabbed:  true,
    grading:  card.grading || null,
    created_at: new Date().toISOString(),
  });

  if (cardErr) {
    return NextResponse.json({ error: cardErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, cardId, batchId });
}
