/**
 * One-time Stripe setup script.
 * Creates all SnapList products and prices in your Stripe account (test or live mode).
 * Run with: npx tsx scripts/setup-stripe.ts
 *
 * After running, copy the output env vars into your .env.local file.
 */

import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
  typescript: true,
});

const PLANS = [
  {
    envKey:       "LISTER",
    name:         "SnapList Lister",
    description:  "300 scans/month — for getting started with scanning and listing",
    monthlyUsd:   1200,   // $12.00
    annualUsd:    12960,  // $10.80/mo × 12
  },
  {
    envKey:       "PRO",
    name:         "SnapList Pro",
    description:  "1,500 scans/month — for casual sellers listing regularly",
    monthlyUsd:   2900,   // $29.00
    annualUsd:    31320,  // $26.10/mo × 12
  },
  {
    envKey:       "BUSINESS",
    name:         "SnapList Business",
    description:  "6,000 scans/month — for active sellers and small stores",
    monthlyUsd:   5900,   // $59.00
    annualUsd:    63720,  // $53.10/mo × 12
  },
  {
    envKey:       "ENTERPRISE",
    name:         "SnapList Enterprise",
    description:  "Unlimited scans — for high-volume sellers and stores",
    monthlyUsd:   14900,  // $149.00
    annualUsd:    160920, // $134.10/mo × 12
  },
];

async function main() {
  console.log("Setting up Stripe products and prices...\n");

  const envLines: string[] = [];

  for (const plan of PLANS) {
    // Create or retrieve product using lookup_key pattern
    const products = await stripe.products.search({
      query: `name:"${plan.name}"`,
    });

    let product: Stripe.Product;
    if (products.data.length > 0) {
      product = products.data[0];
      console.log(`✓ Product already exists: ${plan.name} (${product.id})`);
    } else {
      product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
      });
      console.log(`+ Created product: ${plan.name} (${product.id})`);
    }

    // Monthly price
    const monthlyKey = `snaplist_${plan.envKey.toLowerCase()}_monthly`;
    const existingMonthly = await stripe.prices.list({
      product: product.id,
      recurring: { interval: "month" },
      active: true,
      limit: 1,
    });

    let monthlyPrice: Stripe.Price;
    if (existingMonthly.data.length > 0) {
      monthlyPrice = existingMonthly.data[0];
      console.log(`  ✓ Monthly price exists: ${monthlyPrice.id}`);
    } else {
      monthlyPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.monthlyUsd,
        currency: "usd",
        recurring: { interval: "month" },
        lookup_key: monthlyKey,
        nickname: `${plan.name} Monthly`,
      });
      console.log(`  + Created monthly price: ${monthlyPrice.id}`);
    }

    // Annual price
    const existingAnnual = await stripe.prices.list({
      product: product.id,
      recurring: { interval: "year" },
      active: true,
      limit: 1,
    });

    let annualPrice: Stripe.Price;
    if (existingAnnual.data.length > 0) {
      annualPrice = existingAnnual.data[0];
      console.log(`  ✓ Annual price exists: ${annualPrice.id}`);
    } else {
      annualPrice = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.annualUsd,
        currency: "usd",
        recurring: { interval: "year" },
        lookup_key: `snaplist_${plan.envKey.toLowerCase()}_annual`,
        nickname: `${plan.name} Annual`,
      });
      console.log(`  + Created annual price: ${annualPrice.id}`);
    }

    envLines.push(
      `STRIPE_PRICE_${plan.envKey}_MONTHLY=${monthlyPrice.id}`,
      `STRIPE_PRICE_${plan.envKey}_ANNUAL=${annualPrice.id}`,
    );
  }

  console.log("\n── Add these to your .env.local ──────────────────────────");
  console.log(envLines.join("\n"));
  console.log("──────────────────────────────────────────────────────────");
  console.log("\nDone! Paste the lines above into your .env.local file.");
}

main().catch((err) => {
  console.error("Setup failed:", err.message);
  process.exit(1);
});
