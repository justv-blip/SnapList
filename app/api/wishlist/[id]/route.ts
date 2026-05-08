// PATCH  /api/wishlist/:id — update item (mark found, adjust price, etc.)
// DELETE /api/wishlist/:id — remove item

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { sanitizeString } from "@/lib/validation";

export const runtime = "nodejs";

// ── PATCH ─────────────────────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };

  if ("name" in body)          patch.name          = sanitizeString(body.name as string, 200);
  if ("game" in body)          patch.game          = sanitizeString(body.game as string, 50) || "other";
  if ("set_name" in body)      patch.set_name      = sanitizeString(body.set_name as string, 200) || null;
  if ("notes" in body)         patch.notes         = sanitizeString(body.notes as string, 1000) || null;
  if ("max_price_usd" in body) {
    const v = Number(body.max_price_usd);
    patch.max_price_usd = v > 0 ? v : null;
  }
  if ("found" in body) {
    patch.found    = Boolean(body.found);
    patch.found_at = body.found ? new Date().toISOString() : null;
  }
  if ("alert_price_usd" in body) {
    const v = Number(body.alert_price_usd);
    patch.alert_price_usd = v > 0 ? v : null;
  }
  if ("alert_enabled" in body) {
    patch.alert_enabled = Boolean(body.alert_enabled);
  }

  const { error } = await auth.supabase
    .from("wishlist_items")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// ── DELETE ────────────────────────────────────────────────────────────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const { id } = await params;

  const { error } = await auth.supabase
    .from("wishlist_items")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}
