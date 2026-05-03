// Shared auth + rate-limiting helper for API route handlers.
// Usage: const { user, profile, supabase } = await requireAuth(req);

import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { TIER_LIMITS } from "@/lib/tierLimits";
import { logger } from "@/lib/logger";

export { TIER_LIMITS };

export interface AuthResult {
  user: { id: string; email?: string };
  profile: {
    id: string;
    subscription_tier: string;
    trial_scans_used: number;
    trial_expires_at: string | null;
    stripe_customer_id: string | null;
    credits: number;
  };
  supabase: ReturnType<typeof createServerClient>;
}

export async function requireAuth(req: NextRequest): Promise<AuthResult> {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* read-only in some contexts */ }
        },
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) {
    throw new AuthError("Not authenticated", 401);
  }

  // Fetch the user's profile (includes subscription tier)
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, subscription_tier, trial_scans_used, trial_expires_at, stripe_customer_id, credits")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    throw new AuthError("Profile not found", 403);
  }

  return { user, profile, supabase };
}

// Pre-flight check: verify the user has enough scans remaining.
// Falls back to credits when the plan quota is exhausted.
// Does NOT increment — call `commitScanUsage` after successful processing.
export async function checkScanLimit(
  supabase: ReturnType<typeof createServerClient>,
  profile: AuthResult["profile"],
  imageCount: number
): Promise<{ remaining: number; creditsNeeded: number }> {
  const tier = profile.subscription_tier;
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const userCredits = profile.credits ?? 0;

  if (tier === "free") {
    const used = profile.trial_scans_used || 0;

    if (profile.trial_expires_at && new Date(profile.trial_expires_at) < new Date()) {
      // Expired trial: fall back to credits if available
      if (userCredits >= imageCount) {
        return { remaining: 0, creditsNeeded: imageCount };
      }
      throw new AuthError(
        "Your free trial has expired. Upgrade to keep scanning.",
        403
      );
    }

    if (used + imageCount > limit) {
      // Over quota: fall back to credits if available
      if (userCredits >= imageCount) {
        return { remaining: 0, creditsNeeded: imageCount };
      }
      throw new AuthError(
        `Free trial limit reached (${used}/${limit} scans used). Upgrade to keep scanning or earn credits.`,
        403
      );
    }

    return { remaining: limit - used - imageCount, creditsNeeded: 0 };
  }

  // Paid tiers: check the current billing period (read-only)
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const { data: usage } = await supabase
    .from("scan_usage")
    .select("scan_count")
    .eq("user_id", profile.id)
    .eq("period_start", periodStart.toISOString())
    .single();

  const currentCount = usage?.scan_count || 0;

  if (currentCount + imageCount > limit) {
    // Over quota: fall back to credits if available
    if (userCredits >= imageCount) {
      return { remaining: 0, creditsNeeded: imageCount };
    }
    throw new AuthError(
      `Monthly scan limit reached (${currentCount}/${limit}). Upgrade for more scans or earn credits.`,
      403
    );
  }

  return { remaining: limit - currentCount - imageCount, creditsNeeded: 0 };
}

// Atomically increment scan usage AFTER successful processing.
// Uses Postgres RPCs to avoid race conditions from concurrent requests.
// `successCount` should be the number of scans that actually succeeded.
// `creditsNeeded` should match what checkScanLimit returned — deducted atomically.
export async function commitScanUsage(
  supabase: ReturnType<typeof createServerClient>,
  profile: AuthResult["profile"],
  successCount: number,
  creditsNeeded = 0
): Promise<void> {
  if (successCount <= 0) return;

  // Deduct credits if this scan consumed them instead of plan quota
  if (creditsNeeded > 0) {
    for (let i = 0; i < creditsNeeded; i++) {
      const { data: ok, error } = await supabase.rpc("use_credit");
      if (error) {
        logger.error("use_credit RPC error", { userId: profile.id, error: error.message });
        break; // stop if RPC fails — don't over-deduct
      }
      if (ok === false) {
        logger.warn("use_credit returned false (insufficient balance)", { userId: profile.id });
        break;
      }
    }
    // Credits consumed — don't also charge the plan quota
    return;
  }

  const tier = profile.subscription_tier;
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;

  if (tier === "free") {
    const { data, error } = await supabase.rpc("increment_trial_usage", {
      p_user_id: profile.id,
      p_count: successCount,
      p_limit: limit,
    });

    if (error) {
      logger.error("commitScanUsage RPC error (trial)", { userId: profile.id, error: error.message });
      // Fallback to non-atomic update if RPC doesn't exist yet (pre-migration)
      await supabase
        .from("profiles")
        .update({ trial_scans_used: (profile.trial_scans_used || 0) + successCount })
        .eq("id", profile.id);
      return;
    }

    // data = -1 means limit exceeded, -2 means trial expired
    // At this point we already checked pre-flight, so this is a concurrent race.
    // Log it but don't fail — the scans already happened.
    if (data < 0) {
      logger.warn("commitScanUsage atomic check failed (trial)", { userId: profile.id, code: data });
    }
    return;
  }

  // Paid tiers: atomic increment via RPC
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const { data, error } = await supabase.rpc("increment_scan_usage", {
    p_user_id: profile.id,
    p_period_start: periodStart.toISOString(),
    p_period_end: periodEnd.toISOString(),
    p_count: successCount,
    p_limit: limit,
  });

  if (error) {
    logger.error("commitScanUsage RPC error (paid)", { userId: profile.id, error: error.message });
    // Fallback to non-atomic upsert if RPC doesn't exist yet
    const currentCount = (await supabase
      .from("scan_usage")
      .select("scan_count")
      .eq("user_id", profile.id)
      .eq("period_start", periodStart.toISOString())
      .single()).data?.scan_count || 0;

    await supabase.from("scan_usage").upsert(
      {
        user_id: profile.id,
        scan_count: currentCount + successCount,
        period_start: periodStart.toISOString(),
        period_end: periodEnd.toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,period_start" }
    );
    return;
  }

  if (data < 0) {
    logger.warn("commitScanUsage atomic check failed (paid)", { userId: profile.id, code: data });
  }
}

// Custom error class so route handlers can catch and return proper responses
export class AuthError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Convenience: wrap a route handler with auth + error handling
export function authErrorResponse(err: unknown): NextResponse {
  if (err instanceof AuthError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
