// POST /api/stripe/portal
// Creates a Stripe Billing Portal session so the user can manage or cancel their subscription.
// Returns { url } — the client redirects to it.

import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  const origin = req.headers.get("origin") || "http://localhost:3000";

  // Resolve Stripe customer ID — use saved one, or look up by email as fallback
  let customerId = auth.profile.stripe_customer_id;

  if (!customerId) {
    // Customer ID missing — try to find by email (handles cases where the webhook
    // fired but didn't save the ID, or the account was manually upgraded)
    const email = auth.user.email;
    if (!email) {
      return NextResponse.json(
        { error: "No active subscription found. Please upgrade first." },
        { status: 400 }
      );
    }

    const customers = await stripe.customers.list({ email, limit: 1 });
    if (customers.data.length === 0) {
      return NextResponse.json(
        { error: "No active subscription found. Please upgrade first." },
        { status: 400 }
      );
    }

    customerId = customers.data[0].id;

    // Backfill the customer ID so we don't need to look it up again
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    await supabase
      .from("profiles")
      .update({ stripe_customer_id: customerId, updated_at: new Date().toISOString() })
      .eq("id", auth.user.id);
  }

  try {
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${origin}/settings`,
    });

    logger.info("billing portal session created", { userId: auth.user.id });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    logger.error("stripe portal error", { userId: auth.user.id, message: err.message });
    return NextResponse.json({ error: "Failed to open billing portal" }, { status: 500 });
  }
}
