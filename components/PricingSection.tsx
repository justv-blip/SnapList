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
    description: "For casual sellers listing regularly",
    features: [
      "2,000 scans per month",
      "Unused scans roll over",
      "Everything in Lister",
      "Multi-photo support",
      "Smart pricing engine",
      "Decision engine",
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
    description: "For active sellers and small stores",
    features: [
      "8,000 scans per month",
      "Unused scans roll over",
      "Everything in Pro",
      "Graded card support",
      "eBay & TCGPlayer sync",
      "Trade analyzer",
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
      "Inventory management",
      "Priority support",
      "Bulk scan mode",
    ],
    cta: "Go Enterprise",
    highlight: false,
  },
];

const EXTRA_TIERS = [
  { name: "Empire",   price: "$299", yearlyPrice: "$269.10", limit: "50,000 scans/mo" },
  { name: "Monopoly", price: "$599", yearlyPrice: "$539.10", limit: "Unlimited" },
];

const FEATURE_COMPARISON = [
  { feature: "Card scanning & AI ID",     lister: true,  pro: true,  business: true, enterprise: true },
  { feature: "All TCG games (16+)",       lister: true,  pro: true,  business: true, enterprise: true },
  { feature: "Export to all platforms",   lister: true,  pro: true,  business: true, enterprise: true },
  { feature: "Custom templates",          lister: true,  pro: true,  business: true, enterprise: true },
  { feature: "Scan rollover",             lister: true,  pro: true,  business: true, enterprise: false },
  { feature: "Multi-photo listings",      lister: false, pro: true,  business: true, enterprise: true },
  { feature: "Smart pricing engine",      lister: false, pro: true,  business: true, enterprise: true },
  { feature: "AI decision engine",        lister: false, pro: true,  business: true, enterprise: true },
  { feature: "Graded card support",       lister: false, pro: false, business: true, enterprise: true },
  { feature: "eBay/TCGPlayer sync",       lister: false, pro: false, business: true, enterprise: true },
  { feature: "Trade analyzer",            lister: false, pro: false, business: true, enterprise: true },
  { feature: "Inventory management",      lister: false, pro: false, business: false, enterprise: true },
  { feature: "Duplicate detection",       lister: false, pro: false, business: true, enterprise: true },
  { feature: "Priority support",          lister: false, pro: false, business: false, enterprise: true },
  { feature: "Bulk scan mode",            lister: false, pro: false, business: false, enterprise: true },
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
            Save 10%
          </span>
        </span>
      </div>

      {error && (
        <p className="text-center text-sm text-danger mb-6">{error}</p>
      )}

      {/* Tier cards */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {PRICING.map((plan) => (
          <div
            key={plan.name}
            className={`card-panel flex flex-col ${
              plan.highlight
                ? "border-accent/40 bg-accent/[0.03] ring-1 ring-accent/20"
                : ""
            }`}
          >
            {plan.highlight && (
              <div className="text-[10px] font-semibold text-accent uppercase tracking-widest mb-3">
                Most Popular
              </div>
            )}
            <h3 className="font-semibold text-lg">{plan.name}</h3>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-3xl font-bold">
                {yearly ? plan.yearlyPrice : plan.price}
              </span>
              <span className="text-sm text-muted">{plan.period}</span>
            </div>
            {yearly && (
              <p className="text-[10px] text-accent mt-0.5">
                Billed ${(parseFloat(plan.yearlyPrice.replace("$", "")) * 12).toFixed(2)}/year
              </p>
            )}
            <p className="text-xs text-muted mt-1">{plan.limit}</p>
            <p className="text-xs text-muted mt-1 mb-5">{plan.description}</p>
            <ul className="space-y-2.5 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm">
                  <Check className="w-4 h-4 text-accent2 shrink-0 mt-0.5" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleCheckout(plan.tier)}
              disabled={loading !== null}
              className={`mt-6 w-full justify-center ${
                plan.highlight ? "btn-primary" : "btn"
              } py-2.5`}
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
        ))}
      </div>

      {/* Extra tiers */}
      <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
        {EXTRA_TIERS.map((tier) => (
          <div key={tier.name} className="inline-flex items-center gap-3 px-5 py-3 rounded-xl bg-panel border border-border">
            <div>
              <span className="font-semibold text-sm">{tier.name}</span>
              <span className="text-xs text-muted ml-2">{tier.limit}</span>
            </div>
            <span className="text-lg font-bold">
              {yearly ? tier.yearlyPrice : tier.price}
              <span className="text-xs text-muted font-normal">/mo</span>
            </span>
          </div>
        ))}
        <p className="w-full text-center text-xs text-muted mt-1">
          Empire and Monopoly plans — contact us for a custom quote.
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
