// GET /api/ebay/auth — Initiates eBay OAuth flow.
// Generates a state token, saves it in a cookie, and redirects the user
// to eBay's consent page. After granting access, eBay redirects back to
// /api/ebay/callback with an authorization code.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/ebay/client";
import { randomBytes } from "crypto";

export async function GET() {
  // Ensure user is logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate CSRF-safe state param (includes user ID for callback validation)
  const nonce = randomBytes(16).toString("hex");
  const state = `${user.id}:${nonce}`;

  // Store state in an httpOnly cookie so we can verify it in the callback
  const cookieStore = await cookies();
  cookieStore.set("ebay_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes
    path: "/",
  });

  const authUrl = buildAuthUrl(state);
  return NextResponse.redirect(authUrl);
}
