// GET  /api/wishlist — list the authed user's wishlist items
// POST /api/wishlist — add a new wishlist item

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { sanitizeString } from "@/lib/validation";

export const runtime = "nodejs";

// ── GET ───────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const { data, error } = await auth.supabase
    .from("wishlist_items")
    .select("*")
    .eq("user_id", auth.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ items: data ?? [] });
}

// ── POST ──────────────────────────────────────────────────────────────────────

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

  const name = sanitizeString(body.name as string, 200);
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const maxPrice = body.max_price_usd != null ? Number(body.max_price_usd) : null;

  const { data, error } = await auth.supabase
    .from("wishlist_items")
    .insert({
      user_id:       auth.user.id,
      name,
      game:          sanitizeString(body.game as string, 50) || "other",
      set_name:      sanitizeString(body.set_name as string, 200) || null,
      max_price_usd: maxPrice && maxPrice > 0 ? maxPrice : null,
      notes:         sanitizeString(body.notes as string, 1000) || null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
