// DELETE /api/sealed-items/:id  — remove a sealed item from the user's collection
// PATCH  /api/sealed-items/:id  — update condition or notes

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";

export const runtime = "nodejs";

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
    .from("sealed_items")
    .delete()
    .eq("id", id)
    .eq("user_id", auth.user.id); // RLS + belt-and-suspenders

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return new NextResponse(null, { status: 204 });
}

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

  // Only allow patching safe fields
  const allowed = ["condition", "notes", "market_price_usd", "purchase_price_usd"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  patch.updated_at = new Date().toISOString();

  const { error } = await auth.supabase
    .from("sealed_items")
    .update(patch)
    .eq("id", id)
    .eq("user_id", auth.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
