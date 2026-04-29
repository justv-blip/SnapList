// GET /api/ebay/status — Check if the current user has eBay connected.
// Returns { connected: boolean }.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isEbayConnected } from "@/lib/ebay/client";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const connected = await isEbayConnected(user.id);
    return NextResponse.json({ connected });
  } catch {
    // eBay env vars not configured — treat as not connected
    return NextResponse.json({ connected: false });
  }
}
