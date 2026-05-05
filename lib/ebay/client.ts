// eBay API client — handles OAuth 2.0 token management and HTTP requests.
//
// Supports both sandbox and production. The environment is determined
// by the NEXT_PUBLIC_EBAY_SANDBOX env variable.
//
// Tokens are stored per-user in Supabase (ebay_tokens table).
// This module runs server-side only.

import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Environment config
// ---------------------------------------------------------------------------

// Use EBAY_ENVIRONMENT (server-only) as the single source of truth for sandbox vs production.
// Do NOT use NEXT_PUBLIC_EBAY_SANDBOX — it's a server-side secret and should not be public.
const SANDBOX = process.env.EBAY_ENVIRONMENT !== "production";

const EBAY_CONFIG = {
  clientId: process.env.EBAY_CLIENT_ID || "",
  clientSecret: process.env.EBAY_CLIENT_SECRET || "",
  redirectUri: process.env.EBAY_REDIRECT_URI || "",
  authUrl: SANDBOX
    ? "https://auth.sandbox.ebay.com/oauth2/authorize"
    : "https://auth.ebay.com/oauth2/authorize",
  tokenUrl: SANDBOX
    ? "https://api.sandbox.ebay.com/identity/v1/oauth2/token"
    : "https://api.ebay.com/identity/v1/oauth2/token",
  apiBase: SANDBOX
    ? "https://api.sandbox.ebay.com"
    : "https://api.ebay.com",
  scopes: [
    "https://api.ebay.com/oauth/api_scope",
    "https://api.ebay.com/oauth/api_scope/sell.inventory",
    "https://api.ebay.com/oauth/api_scope/sell.marketing",
    "https://api.ebay.com/oauth/api_scope/sell.account",
    "https://api.ebay.com/oauth/api_scope/sell.fulfillment",
  ],
};

export { EBAY_CONFIG };

// ---------------------------------------------------------------------------
// Token types
// ---------------------------------------------------------------------------

export interface EbayTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // epoch ms
  scope: string;
}

// ---------------------------------------------------------------------------
// Supabase admin client (service role — server-side only)
// ---------------------------------------------------------------------------

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error("Supabase service role not configured");
  }
  return createSupabaseAdmin(url, serviceKey);
}

// ---------------------------------------------------------------------------
// OAuth helpers
// ---------------------------------------------------------------------------

/** Build the eBay OAuth consent URL the user should be redirected to. */
export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: EBAY_CONFIG.clientId,
    redirect_uri: EBAY_CONFIG.redirectUri,
    response_type: "code",
    scope: EBAY_CONFIG.scopes.join(" "),
    state,
  });
  return `${EBAY_CONFIG.authUrl}?${params.toString()}`;
}

/** Exchange an authorization code for access + refresh tokens. */
export async function exchangeCode(code: string): Promise<EbayTokens> {
  const credentials = Buffer.from(
    `${EBAY_CONFIG.clientId}:${EBAY_CONFIG.clientSecret}`
  ).toString("base64");

  const res = await fetch(EBAY_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: EBAY_CONFIG.redirectUri,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`eBay token exchange failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope || "",
  };
}

/** Refresh an expired access token using the refresh token. */
export async function refreshAccessToken(refreshToken: string): Promise<EbayTokens> {
  const credentials = Buffer.from(
    `${EBAY_CONFIG.clientId}:${EBAY_CONFIG.clientSecret}`
  ).toString("base64");

  const res = await fetch(EBAY_CONFIG.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: EBAY_CONFIG.scopes.join(" "),
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`eBay token refresh failed: ${err}`);
  }

  const data = await res.json();
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
    scope: data.scope || "",
  };
}

// ---------------------------------------------------------------------------
// Token persistence (Supabase)
// ---------------------------------------------------------------------------

export async function saveTokens(userId: string, tokens: EbayTokens): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from("ebay_tokens").upsert({
    user_id: userId,
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    expires_at: new Date(tokens.expiresAt).toISOString(),
    scope: tokens.scope,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

export async function getTokens(userId: string): Promise<EbayTokens | null> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("ebay_tokens")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle(); // .single() returns 406 when 0 rows; .maybeSingle() returns null

  if (error || !data) return null;

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: new Date(data.expires_at).getTime(),
    scope: data.scope || "",
  };
}

export async function deleteTokens(userId: string): Promise<void> {
  const admin = getAdminClient();
  await admin.from("ebay_tokens").delete().eq("user_id", userId);
}

/** Get a valid access token, refreshing if expired. */
export async function getValidToken(userId: string): Promise<string> {
  const tokens = await getTokens(userId);
  if (!tokens) throw new Error("eBay not connected. Please connect your eBay account in Settings.");

  // Refresh if token expires in < 5 minutes
  if (tokens.expiresAt < Date.now() + 5 * 60 * 1000) {
    const refreshed = await refreshAccessToken(tokens.refreshToken);
    await saveTokens(userId, refreshed);
    return refreshed.accessToken;
  }

  return tokens.accessToken;
}

// ---------------------------------------------------------------------------
// Authenticated eBay API request helper
// ---------------------------------------------------------------------------

export async function ebayFetch(
  userId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getValidToken(userId);
  const url = `${EBAY_CONFIG.apiBase}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
      ...(options.headers || {}),
    },
  });

  return res;
}

// ---------------------------------------------------------------------------
// Connection status check
// ---------------------------------------------------------------------------

export async function isEbayConnected(userId: string): Promise<boolean> {
  const tokens = await getTokens(userId);
  return tokens !== null;
}
