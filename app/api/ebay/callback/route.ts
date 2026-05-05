// GET /api/ebay/callback — Handles eBay OAuth redirect.
// Validates state, exchanges the authorization code for tokens,
// persists them in Supabase, and redirects back to Settings.

import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { exchangeCode, saveTokens } from "@/lib/ebay/client";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const settingsUrl = new URL("/settings", request.nextUrl.origin);

  // eBay denied / user cancelled
  if (error) {
    settingsUrl.searchParams.set("ebay", "error");
    settingsUrl.searchParams.set("ebay_msg", error);
    return NextResponse.redirect(settingsUrl);
  }

  if (!code || !state) {
    settingsUrl.searchParams.set("ebay", "error");
    settingsUrl.searchParams.set("ebay_msg", "Missing authorization code");
    return NextResponse.redirect(settingsUrl);
  }

  // Validate state against cookie
  const cookieStore = await cookies();
  const savedState = cookieStore.get("ebay_oauth_state")?.value;

  if (!savedState || savedState !== state) {
    settingsUrl.searchParams.set("ebay", "error");
    settingsUrl.searchParams.set("ebay_msg", "Invalid state — please try again");
    return NextResponse.redirect(settingsUrl);
  }

  // Clear the state cookie
  cookieStore.delete("ebay_oauth_state");

  // Extract user ID from state
  const userId = state.split(":")[0];
  if (!userId) {
    settingsUrl.searchParams.set("ebay", "error");
    settingsUrl.searchParams.set("ebay_msg", "Invalid state format");
    return NextResponse.redirect(settingsUrl);
  }

  // Security: verify the authenticated session belongs to the user in the state.
  // Prevents an attacker who obtained a valid state token from linking their eBay
  // account to a different user's SnapList account.
  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (toSet) => {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.id !== userId) {
      settingsUrl.searchParams.set("ebay", "error");
      settingsUrl.searchParams.set("ebay_msg", "Session mismatch — please try again");
      return NextResponse.redirect(settingsUrl);
    }
  } catch {
    settingsUrl.searchParams.set("ebay", "error");
    settingsUrl.searchParams.set("ebay_msg", "Could not verify session");
    return NextResponse.redirect(settingsUrl);
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCode(code);

    // Persist tokens
    await saveTokens(userId, tokens);

    settingsUrl.searchParams.set("ebay", "connected");
    return NextResponse.redirect(settingsUrl);
  } catch (err) {
    console.error("eBay token exchange failed:", err);
    settingsUrl.searchParams.set("ebay", "error");
    settingsUrl.searchParams.set(
      "ebay_msg",
      err instanceof Error ? err.message : "Token exchange failed"
    );
    return NextResponse.redirect(settingsUrl);
  }
}
