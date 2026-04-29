// POST /api/stripe/checkout
// Creates a Stripe Checkout session for the requested tier + interval.
// Returns { url } — the client redirects to it.

import { NextRequest, NextResponse } from "next/server";
import { stripe, getPriceId } from "@/lib/stripe";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const VALID_INTERVALS = ["monthly", "annual"] as const;
type Interval = typeof VALID_INTERVALS[number];

const VALID_TIERS = ["starter", "pro", "business", "enterprise"] as const;
type Tier = typeof VALID_TIERS[number];

export async function POST(req: NextRequest) {
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  let body: { tier?: string; interval?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Expected JSON body" }, { status: 400 });
  }

  const tier = body.tier as Tier;
  const interval = (body.interval ?? "monthly") as Interval;

  if (!VALID_TIERS.includes(tier)) {
    return NextResponse.json({ error: "Invalid tier" }, { status: 400 });
  }
  if (!VALID_INTERVALS.includes(interval)) {
    return NextResponse.json({ error: "Invalid interval" }, { status: 400 });
  }

  const priceId = getPriceId(tier, interval);
  if (!priceId) {
    logger.error("Missing Stripe price ID", { tier, interval });
    return NextResponse.json(
      { error: "Pricing not configured. Run scripts/setup-stripe.ts first." },
      { status: 500 }
    );
  }

  const origin = req.headers.get("origin") || "http://localhost:3000";

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      // Pre-fill email from existing account
      customer_email: auth.profile.stripe_customer_id ? undefined : auth.user.email,
      customer: auth.profile.stripe_customer_id ?? undefined,
      // Metadata on the session — readable in checkout.session.completed webhook
      metadata: { userId: auth.user.id, tier, interval },
      // Metadata on the subscription — readable in customer.subscription.* webhooks
      subscription_data: {
        metadata: { userId: auth.user.id, tier, interval },
      },
      success_url: `${origin}/settings?upgraded=true&tier=${tier}`,
      cancel_url: `${origin}/settings?upgraded=false`,
      allow_promotion_codes: true,
    });

    logger.info("checkout session created", {
      userId: auth.user.id,
      tier,
      interval,
      sessionId: session.id,
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    logger.error("stripe checkout error", { userId: auth.user.id, message: err.message });
    return NextResponse.json({ error: "Failed to create checkout session" }, { status: 500 });
  }
}
