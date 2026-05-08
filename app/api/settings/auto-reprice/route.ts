// GET  /api/settings/auto-reprice  — fetch current auto-reprice prefs
// PATCH /api/settings/auto-reprice  — update auto-reprice prefs

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("profiles")
    .select("auto_reprice_enabled, auto_reprice_threshold_pct, auto_reprice_last_run_at")
    .eq("id", user.id)
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    enabled: data?.auto_reprice_enabled ?? false,
    thresholdPct: data?.auto_reprice_threshold_pct ?? 10,
    lastRunAt: data?.auto_reprice_last_run_at ?? null,
  });
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const updates: Record<string, unknown> = {};

  if (typeof body.enabled === "boolean") updates.auto_reprice_enabled = body.enabled;
  if (typeof body.thresholdPct === "number" && body.thresholdPct >= 1 && body.thresholdPct <= 100) {
    updates.auto_reprice_threshold_pct = Math.round(body.thresholdPct);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
