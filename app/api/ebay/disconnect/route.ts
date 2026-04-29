// POST /api/ebay/disconnect — Disconnect eBay by deleting stored tokens.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { deleteTokens } from "@/lib/ebay/client";

export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await deleteTokens(user.id);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("eBay disconnect failed:", err);
    return NextResponse.json(
      { error: "Failed to disconnect eBay" },
      { status: 500 }
    );
  }
}
