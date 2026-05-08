"use client";

import { useState } from "react";
import { ArrowRight, Check, X, ChevronDown, Loader2 } from "lucide-react";

// DB tier key used when calling /api/stripe/checkout
type Tier = "starter" | "pro" | "business" | "enterprise";

const PRICING: {
  name: string;
  tier: Tier;
  price: string;
  yearlyPrice: string;
  period: string;
  limit: string;
  description: string;
  features: string[];
  cta: string;
  highlight: boolean;
}[] = [
  {
    name: "Lister",
    tier: "starter",
    price: "$12",
    yearlyPrice: "$10.80",
    period: "/mo",
    limit: "500 scans/mo",
    description: "For getting started with scanning and listing",
    features: [
      "500 scans per month",
      "Unused scans roll over",
      "All TCG games",
      "Basic scanning & listing",
      "All export formats",
      "Custom templates",
    ],
    cta: "Get Started",
    highlight: false,
  },
  {
    name: "Pro",
    tier: "pro",
    price: "$29",
    yearlyPrice: "$26.10",
    period: "/mo",
    limit: "2,000 scans/mo",
    description: "Every selling tool — graded cards, sync, and pricing AI",
    features: [
      "2,000 scans per month",
      "Unused scans roll over",
      "Everything in Lister",
      "Graded card support",
      "eBay & TCGPlayer sync",
      "Smart pricing & decision engine",
      "Trade analyzer",
    ],
    cta: "Go Pro",
    highlight: false,
  },
  {
    name: "Business",
    tier: "business",
    price: "$59",
    yearlyPrice: "$53.10",
    period: "/mo",
    limit: "8,000 scans/mo",
    description: "Pro power at scale, with full inventory management",
    features: [
      "8,000 scans per month",
      "Unused scans roll over",
      "Everything in Pro",
      "Inventory management",
      "Stock tracking & reports",
      "Duplicate detection",
    ],
    cta: "Start Business",
    highlight: true,
  },
  {
    name: "Enterprise",
    tier: "enterprise",
    price: "$149",
    yearlyPrice: "$134.10",
    period: "/mo",
    limit: "Unlimited scans",
    description: "For high-volume sellers and stores",
    features: [
      "Unlimited scans",
      "Everything in Business",
      "Priority support",
      "Dedicated onboarding",
    ],
    cta: "Go Enterprise",
    highlight: false,
  },
];

const EXTRA_TIERS = [
  { name: "Team",   price: "$299", yearlyPrice: "$269.10", limit: "50,000 scans/mo", description: "For multi-seller operations and card shops" },
  { name: "Agency", price: "$599", yearlyPrice: "$539.10", limit: "Unlimited scans",  description: "White-label ready for large-scale operations" },
];

const FEATURE_COMPARISON = [
  { feature: "Card scanning & AI ID",     lister: true,  pro: true,  business: true,  enterprise: true },
  { feature: "All TCG games (16+)",       lister: true,  pro: true,  business: true,  enterprise: true },
  { feature: "Export to all platforms",   lister: true,  pro: true,  business: true,  enterprise: true },
  { feature: "Custom templates",          lister: true,  pro: true,  business: true,  enterprise: true },
  { feature: "Scan rollover",             lister: true,  pro: true,  business: true,  enterprise: false },
  { feature: "Multi-photo listings",      lister: false, pro: true,  business: true,  enterprise: true },
  { feature: "Smart pricing engine",      lister: false, pro: true,  business: true,  enterprise: true },
  { feature: "AI decision engine",        lister: false, pro: true,  business: true,  enterprise: true },
  { feature: "Graded card support",       lister: false, pro: true,  business: true,  enterprise: true },
  { feature: "eBay/TCGPlayer sync",       lister: false, pro: true,  business: true,  enterprise: true },
  { feature: "Trade analyzer",            lister: false, pro: true,  business: true,  enterprise: true },
  { feature: "Duplicate detection",       lister: false, pro: true,  business: true,  enterprise: true },
  { feature: "Inventory management",      lister: false, pro: false, business: true,  enterprise: true },
  { feature: "Stock tracking & reports",  lister: false, pro: false, business: true,  enterprise: true },
  { feature: "Priority support",          lister: false, pro: false, business: false, enterprise: true },
];

async function startCheckout(tier: Tier, interval: "monthly" | "annual") {
  const res = await fetch("/api/stripe/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tier, interval }),
  });
  if (!res.ok) {
    const { error } = await res.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(error || "Failed to start checkout");
  }
  const { url } = await res.json();
  window.location.href = url;
}

export function PricingSection() {
  const [yearly, setYearly] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [loading, setLoading] = useState<Tier | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCheckout = async (tier: Tier) => {
    setError(null);
    setLoading(tier);
    try {
      await startCheckout(tier, yearly ? "annual" : "monthly");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
      setLoading(null);
    }
  };

  return (
    <>
      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-10">
        <span className={`text-sm font-medium ${!yearly ? "text-foreground" : "text-muted"}`}>Monthly</span>
        <button
          onClick={() => setYearly((v) => !v)}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            yearly ? "bg-accent" : "bg-panel2 border border-border"
          }`}
        >
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
              yearly ? "translate-x-6" : "translate-x-0.5"
            }`}
          />
        </button>
        <span className={`text-sm font-medium ${yearly ? "text-foreground" : "text-muted"}`}>
          Yearly
          <span className="ml-1.5 text-[10px] font-semibold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full">
            Save up to $178/yr
          </span>
        </span>
      </div>

      {error && (
        <p className="text-center text-sm text-danger mb-6">{error}</p>
      )}

      {/* Tier cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 items-start">
        {PRICING.map((plan) => {
          const monthlyNum  = parseFloat(plan.price.replace("$", ""));
          const yearlyNum   = parseFloat(plan.yearlyPrice.replace("$", ""));
          const annualSaving = Math.round((monthlyNum - yearlyNum) * 12);

          return (
            <div
              key={plan.name}
              className={`card-panel flex flex-col relative ${
                plan.highlight
                  ? "border-accent/50 bg-accent/[0.04] shadow-2xl shadow-accent/15 ring-1 ring-accent/25 lg:-translate-y-2"
                  : ""
              }`}
            >
              {/* Most Popular badge */}
              {plan.highlight && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-accent text-black shadow-lg shadow-accent/30">
                    ★ Most Popular
                  </span>
                </div>
              )}

              <div className={plan.highlight ? "pt-3" : ""}>
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">
                    {yearly ? plan.yearlyPrice : plan.price}
                  </span>
                  <span className="text-sm text-muted">{plan.period}</span>
                </div>
                {yearly ? (
                  <p className="text-[10px] text-accent mt-0.5 font-medium">
                    Save ${annualSaving}/yr · billed ${(yearlyNum * 12).toFixed(2)}/yr
                  </p>
                ) : (
                  <p className="text-[10px] text-muted mt-0.5">
                    or ${plan.yearlyPrice}/mo billed yearly
                  </p>
                )}
                <p className="text-xs text-muted mt-1">{plan.limit}</p>
                <p className="text-xs text-muted mt-1 mb-5">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className={`w-4 h-4 shrink-0 mt-0.5 ${plan.highlight ? "text-accent" : "text-accent2"}`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleCheckout(plan.tier)}
                disabled={loading !== null}
                className={`mt-6 w-full justify-center py-2.5 ${
                  plan.highlight ? "btn-primary shadow-lg shadow-accent/20" : "btn"
                }`}
              >
                {loading === plan.tier ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    {plan.cta}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* Volume tiers */}
      <div className="mt-8 rounded-2xl border border-border bg-panel/50 p-6">
        <div className="text-center mb-5">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-1">Volume Plans</p>
          <p className="text-sm text-muted">For high-volume operations and card shops — contact us for a custom quote.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          {EXTRA_TIERS.map((tier) => (
            <div key={tier.name} className="flex items-center justify-between gap-4 p-4 rounded-xl bg-panel2 border border-border">
              <div>
                <p className="font-semibold">{tier.name}</p>
                <p className="text-xs text-muted mt-0.5">{tier.description}</p>
                <p className="text-xs text-accent mt-1">{tier.limit}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold">
                  {yearly ? tier.yearlyPrice : tier.price}
                  <span className="text-xs text-muted font-normal">/mo</span>
                </p>
                {yearly && (
                  <p className="text-[10px] text-accent">billed yearly</p>
                )}
              </div>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted mt-4">
          Need something custom?{" "}
          <a href="/contact" className="text-accent hover:underline">Contact us</a> and we&apos;ll build a plan around your volume.
        </p>
      </div>

      {/* Feature comparison toggle */}
      <div className="mt-10 text-center">
        <button
          onClick={() => setShowComparison((v) => !v)}
          className="inline-flex items-center gap-2 text-sm text-accent hover:underline"
        >
          {showComparison ? "Hide" : "View"} full feature comparison
          <ChevronDown className={`w-4 h-4 transition-transform ${showComparison ? "rotate-180" : ""}`} />
        </button>
      </div>

      {/* Feature comparison table */}
      {showComparison && (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-3 px-4 text-xs text-muted uppercase tracking-wider font-medium">Feature</th>
                <th className="text-center py-3 px-4 text-xs text-muted uppercase tracking-wider font-medium">Lister</th>
                <th className="text-center py-3 px-4 text-xs text-muted uppercase tracking-wider font-medium">Pro</th>
                <th className="text-center py-3 px-4 text-xs text-accent uppercase tracking-wider font-medium">Business</th>
                <th className="text-center py-3 px-4 text-xs text-muted uppercase tracking-wider font-medium">Enterprise+</th>
              </tr>
            </thead>
            <tbody>
              {FEATURE_COMPARISON.map((row) => (
                <tr key={row.feature} className="border-b border-border/50 last:border-0">
                  <td className="py-3 px-4 text-muted">{row.feature}</td>
                  <td className="py-3 px-4 text-center">{row.lister ? <Check className="w-4 h-4 text-accent2 mx-auto" /> : <X className="w-4 h-4 text-muted/30 mx-auto" />}</td>
                  <td className="py-3 px-4 text-center">{row.pro ? <Check className="w-4 h-4 text-accent2 mx-auto" /> : <X className="w-4 h-4 text-muted/30 mx-auto" />}</td>
                  <td className="py-3 px-4 text-center">{row.business ? <Check className="w-4 h-4 text-accent2 mx-auto" /> : <X className="w-4 h-4 text-muted/30 mx-auto" />}</td>
                  <td className="py-3 px-4 text-center">{row.enterprise ? <Check className="w-4 h-4 text-accent2 mx-auto" /> : <X className="w-4 h-4 text-muted/30 mx-auto" />}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
