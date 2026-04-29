// POST /api/stripe/webhook
// Handles Stripe webhook events.
// Signature verified with STRIPE_WEBHOOK_SECRET — events without a valid signature are rejected.
//
// To test locally:
//   stripe listen --forward-to localhost:3000/api/stripe/webhook
//   (outputs a whsec_... secret — add it to .env.local as STRIPE_WEBHOOK_SECRET)

import { NextRequest, NextResponse } from "next/server";
import { stripe, getDbTierFromPriceId } from "@/lib/stripe";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { logger } from "@/lib/logger";
import type Stripe from "stripe";

export const runtime = "nodejs";

// Stripe requires the raw body for signature verification — disable Next.js body parsing.
export const dynamic = "force-dynamic";

async function updateProfileTier(
  userId: string,
  tier: string,
  stripeCustomerId?: string
) {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!, // service role bypasses RLS
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  );

  const updates: Record<string, unknown> = {
    subscription_tier: tier,
    updated_at: new Date().toISOString(),
  };
  if (stripeCustomerId) updates.stripe_customer_id = stripeCustomerId;

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);

  if (error) {
    logger.error("failed to update profile tier", { userId, tier, error: error.message });
  } else {
    logger.info("profile tier updated", { userId, tier });
  }
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    logger.error("STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
  }

  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing stripe-signature header" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err: any) {
    logger.warn("stripe webhook signature verification failed", { message: err.message });
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  logger.info("stripe webhook received", { type: event.type, id: event.id });

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = session.metadata?.userId as string | undefined;
        const tier   = session.metadata?.tier   as string | undefined;

        if (!userId || !tier) {
          logger.warn("checkout.session.completed missing metadata", { sessionId: session.id });
          break;
        }

        await updateProfileTier(
          userId,
          tier,
          session.customer as string | undefined
        );
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId as string | undefined;
        if (!userId) break;

        // Determine tier from the first price in the subscription
        const priceId = sub.items.data[0]?.price?.id;
        const tier = priceId ? getDbTierFromPriceId(priceId) : null;

        if (tier) {
          await updateProfileTier(userId, tier);
        } else {
          logger.warn("customer.subscription.updated: unknown priceId", { priceId, userId });
        }
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId as string | undefined;
        if (!userId) break;
        // Subscription cancelled — downgrade to free
        await updateProfileTier(userId, "free");
        break;
      }

      default:
        // Ignore unhandled event types
        break;
    }
  } catch (err: any) {
    logger.error("stripe webhook handler error", { type: event.type, message: err.message });
    // Return 200 to prevent Stripe from retrying — we'll investigate via logs
    return NextResponse.json({ received: true });
  }

  return NextResponse.json({ received: true });
}
