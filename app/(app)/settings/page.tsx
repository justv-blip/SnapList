"use client";

import { useEffect, useState } from "react";
import {
  User,
  CreditCard,
  BarChart3,
  Camera,
  FileSpreadsheet,
  DollarSign,
  Palette,
  Shield,
  ExternalLink,
  Loader2,
  Brain,
  ShoppingBag,
  CheckCircle2,
  XCircle,
  Link2,
  Unlink,
  Sun,
  Moon,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/Toast";
import { useTheme, ACCENT_COLORS, type ThemeMode, type AccentColor } from "@/lib/theme";
import { SettingsSkeleton } from "@/components/Skeleton";
import { TIER_LIMITS, TIER_LABELS } from "@/lib/tierLimits";
import { ScanUsageCard } from "@/components/ScanUsageCard";
import { DEFAULT_DECISION_RULES, type DecisionRules } from "@/lib/decisionEngine";
import {
  DEFAULT_PRICING_CONFIG,
  PRICING_STRATEGY_LABELS,
  PRICING_STRATEGY_DESCRIPTIONS,
  ROUNDING_LABELS,
  type PricingConfig,
  type PricingStrategy,
  type RoundingRule,
} from "@/lib/pricingEngine";
import { CONDITIONS, type Condition } from "@/lib/types";

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  tier: string;
  trialScansUsed: number;
  trialExpiresAt: string | null;
  stripeCustomerId: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [decisionRules, setDecisionRules] = useState<DecisionRules>({ ...DEFAULT_DECISION_RULES });
  const [rulesSaved, setRulesSaved] = useState(false);
  const [pricingConfig, setPricingConfig] = useState<PricingConfig>({ ...DEFAULT_PRICING_CONFIG });
  const [pricingSaved, setPricingSaved] = useState(false);
  const [ebayConnected, setEbayConnected] = useState(false);
  const [ebayLoading, setEbayLoading] = useState(true);
  const [ebayDisconnecting, setEbayDisconnecting] = useState(false);
  const [billingLoading, setBillingLoading] = useState(false);
  // Scanning / listing preference state (persisted in localStorage)
  const [defaultGame, setDefaultGamePref] = useState("pokemon");
  const [defaultCamera, setDefaultCamera] = useState("environment");
  const [defaultCondition, setDefaultCondition] = useState("Near Mint");
  const [currency, setCurrency] = useState("USD");
  const { toast } = useToast();

  const patchRules = (updates: Partial<DecisionRules>) => {
    setDecisionRules((prev) => ({ ...prev, ...updates }));
    setRulesSaved(false);
  };

  const patchPricing = (updates: Partial<PricingConfig>) => {
    setPricingConfig((prev) => ({ ...prev, ...updates }));
    setPricingSaved(false);
  };

  const saveDecisionRules = () => {
    try {
      localStorage.setItem("decision_rules", JSON.stringify(decisionRules));
      setRulesSaved(true);
      toast("success", "Decision rules saved");
      setTimeout(() => setRulesSaved(false), 2000);
    } catch {
      toast("error", "Failed to save decision rules");
    }
  };

  const savePricingConfig = () => {
    try {
      localStorage.setItem("pricing_config", JSON.stringify(pricingConfig));
      setPricingSaved(true);
      toast("success", "Pricing settings saved");
      setTimeout(() => setPricingSaved(false), 2000);
    } catch {
      toast("error", "Failed to save pricing settings");
    }
  };

  const handleUpgrade = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: "pro", interval: "monthly" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to start checkout");
      window.location.href = data.url;
    } catch (err: any) {
      toast("error", err.message || "Failed to open checkout");
      setBillingLoading(false);
    }
  };

  const handleManageBilling = async () => {
    setBillingLoading(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to open billing portal");
      window.location.href = data.url;
    } catch (err: any) {
      toast("error", err.message || "Failed to open billing portal");
      setBillingLoading(false);
    }
  };

  const disconnectEbay = async () => {
    setEbayDisconnecting(true);
    try {
      const res = await fetch("/api/ebay/disconnect", { method: "POST" });
      if (res.ok) {
        setEbayConnected(false);
        toast("success", "eBay account disconnected");
      } else {
        toast("error", "Failed to disconnect eBay");
      }
    } catch {
      toast("error", "Failed to disconnect eBay");
    } finally {
      setEbayDisconnecting(false);
    }
  };

  // Load saved settings on mount
  useEffect(() => {
    try {
      const savedRules = localStorage.getItem("decision_rules");
      if (savedRules) setDecisionRules(JSON.parse(savedRules));
      const savedPricing = localStorage.getItem("pricing_config");
      if (savedPricing) setPricingConfig(JSON.parse(savedPricing));
      // Load scanning / listing preferences
      setDefaultGamePref(localStorage.getItem("settings_default_game") || "pokemon");
      setDefaultCamera(localStorage.getItem("settings_default_camera") || "environment");
      setDefaultCondition(localStorage.getItem("settings_default_condition") || "Near Mint");
      setCurrency(localStorage.getItem("settings_currency") || "USD");
    } catch { /* ignore */ }
  }, []);

  // Check eBay connection status on mount + handle OAuth redirect params
  useEffect(() => {
    async function checkEbay() {
      try {
        const res = await fetch("/api/ebay/status");
        if (res.ok) {
          const data = await res.json();
          setEbayConnected(data.connected);
        }
      } catch { /* ignore */ } finally {
        setEbayLoading(false);
      }
    }
    checkEbay();

    // Handle Stripe redirect params
    const params = new URLSearchParams(window.location.search);
    const upgradedParam = params.get("upgraded");
    if (upgradedParam === "true") {
      const tier = params.get("tier") || "paid";
      toast("success", `You're now on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} plan!`);
      window.history.replaceState({}, "", "/settings");
      loadProfile(); // Refresh profile to show new tier
    } else if (upgradedParam === "false") {
      toast("error", "Checkout cancelled — no charge was made.");
      window.history.replaceState({}, "", "/settings");
    }

    // Handle eBay OAuth redirect query params
    const ebayParam = params.get("ebay");
    if (ebayParam === "connected") {
      toast("success", "eBay account connected successfully!");
      setEbayConnected(true);
      // Clean URL
      window.history.replaceState({}, "", "/settings");
    } else if (ebayParam === "error") {
      const msg = params.get("ebay_msg") || "Failed to connect eBay";
      toast("error", `eBay: ${msg}`);
      window.history.replaceState({}, "", "/settings");
    }
  }, []);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: p } = await supabase
        .from("profiles")
        .select(
          "id, display_name, subscription_tier, trial_scans_used, trial_expires_at, stripe_customer_id, created_at"
        )
        .eq("id", user.id)
        .single();

      if (p) {
        setProfile({
          id: p.id,
          email: user.email || "",
          displayName: p.display_name || user.email?.split("@")[0] || "User",
          tier: p.subscription_tier || "free",
          trialScansUsed: p.trial_scans_used || 0,
          trialExpiresAt: p.trial_expires_at,
          stripeCustomerId: p.stripe_customer_id,
          createdAt: p.created_at,
        });
      }

      // Get current period scan count for paid tiers
      if (p && p.subscription_tier !== "free") {
        const now = new Date();
        const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const { data: usage } = await supabase
          .from("scan_usage")
          .select("scan_count")
          .eq("user_id", user.id)
          .eq("period_start", periodStart.toISOString())
          .single();
        setScanCount(usage?.scan_count || 0);
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
      toast("error", "Failed to load account info");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted mt-1">Account, plan, and preferences</p>
        </div>
        <SettingsSkeleton />
      </div>
    );
  }

  const tier = profile?.tier || "free";
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const used = tier === "free" ? (profile?.trialScansUsed || 0) : scanCount;
  const usagePercent = Math.min(100, Math.round((used / limit) * 100));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-1">Account, plan, and preferences</p>
      </div>

      {/* ── Account ── */}
      <div className="card-panel">
        <div className="flex items-center gap-2 mb-5">
          <User className="w-5 h-5 text-accent" />
          <h2 className="font-semibold">Account</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Email</label>
            <p className="text-sm mt-1">{profile?.email}</p>
          </div>
          <div>
            <label className="label">Display Name</label>
            <p className="text-sm mt-1">{profile?.displayName}</p>
          </div>
          <div>
            <label className="label">Member Since</label>
            <p className="text-sm mt-1">
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "—"}
            </p>
          </div>
          <div>
            <label className="label">Email Verified</label>
            <p className="text-sm mt-1 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-accent2" />
              Verified
            </p>
          </div>
        </div>
      </div>

      {/* ── Plan & Usage ── */}
      <div className="card-panel">
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="w-5 h-5 text-accent" />
          <h2 className="font-semibold">Plan &amp; Usage</h2>
        </div>

        <ScanUsageCard
          tier={tier}
          scansUsed={used}
          trialExpiresAt={profile?.trialExpiresAt}
          onUpgrade={handleUpgrade}
        />

        {/* Manage subscription (paid tiers) */}
        {tier !== "free" && (
          <div className="mt-4 pt-4 border-t border-border">
            <button
              onClick={handleManageBilling}
              disabled={billingLoading}
              className="btn"
            >
              {billingLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ExternalLink className="w-4 h-4" />
              )}
              Manage Subscription
            </button>
            <p className="text-[10px] text-muted mt-1.5">
              Cancel, change plan, or update payment method via Stripe.
            </p>
          </div>
        )}

        {/* Upgrade CTA note */}
        {tier === "free" && (
          <p className="text-[10px] text-muted mt-3">
            You&apos;ll be taken to a secure Stripe checkout page.
          </p>
        )}
      </div>

      {/* ── Scanning Preferences ── */}
      <div className="card-panel">
        <div className="flex items-center gap-2 mb-5">
          <Camera className="w-5 h-5 text-accent" />
          <h2 className="font-semibold">Scanning</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Default Game</label>
            <select
              className="input mt-1"
              value={defaultGame}
              onChange={(e) => {
                setDefaultGamePref(e.target.value);
                localStorage.setItem("settings_default_game", e.target.value);
                toast("success", "Default game saved");
              }}
            >
              <option value="pokemon">Pokémon</option>
              <option value="mtg">Magic: The Gathering</option>
              <option value="yugioh">Yu-Gi-Oh!</option>
              <option value="onepiece">One Piece</option>
              <option value="digimon">Digimon</option>
              <option value="lorcana">Disney Lorcana</option>
              <option value="fleshandblood">Flesh and Blood</option>
              <option value="dragonball">Dragon Ball Super</option>
              <option value="weissschwarz">Weiss Schwarz</option>
              <option value="sports">Sports</option>
            </select>
          </div>
          <div>
            <label className="label">Default Camera</label>
            <select
              className="input mt-1"
              value={defaultCamera}
              onChange={(e) => {
                setDefaultCamera(e.target.value);
                localStorage.setItem("settings_default_camera", e.target.value);
                toast("success", "Default camera saved");
              }}
            >
              <option value="environment">Rear Camera</option>
              <option value="user">Front Camera</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── Listing Defaults ── */}
      <div className="card-panel">
        <div className="flex items-center gap-2 mb-5">
          <FileSpreadsheet className="w-5 h-5 text-accent" />
          <h2 className="font-semibold">Listing Defaults</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Default Condition</label>
            <select
              className="input mt-1"
              value={defaultCondition}
              onChange={(e) => {
                setDefaultCondition(e.target.value);
                localStorage.setItem("settings_default_condition", e.target.value);
                toast("success", "Default condition saved");
              }}
            >
              <option>Near Mint</option>
              <option>Lightly Played</option>
              <option>Moderately Played</option>
              <option>Heavily Played</option>
              <option>Damaged</option>
            </select>
          </div>
          <div>
            <label className="label">Currency</label>
            <select
              className="input mt-1"
              value={currency}
              onChange={(e) => {
                setCurrency(e.target.value);
                localStorage.setItem("settings_currency", e.target.value);
                toast("success", "Currency saved");
              }}
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD (C$)</option>
              <option value="AUD">AUD (A$)</option>
            </select>
          </div>
        </div>
      </div>

      {/* ── eBay Connection ── */}
      <div className="card-panel">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-accent" />
            <h2 className="font-semibold">eBay Integration</h2>
          </div>
          {ebayLoading ? (
            <Loader2 className="w-4 h-4 animate-spin text-muted" />
          ) : ebayConnected ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-accent2/10 border border-accent2/30 text-accent2">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-panel2 border border-border text-muted">
              <XCircle className="w-3.5 h-3.5" />
              Not Connected
            </span>
          )}
        </div>

        <p className="text-xs text-muted mb-4">
          Connect your eBay seller account to list cards directly from the scanner — no CSV
          exports or manual data entry required.
        </p>

        {ebayConnected ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm text-accent2">
              <CheckCircle2 className="w-4 h-4" />
              Your eBay seller account is linked. You can push listings directly from scanned cards.
            </div>
            <button
              className="btn text-xs text-danger hover:text-danger/80"
              onClick={disconnectEbay}
              disabled={ebayDisconnecting}
            >
              {ebayDisconnecting ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Unlink className="w-3.5 h-3.5" />
              )}
              {ebayDisconnecting ? "Disconnecting…" : "Disconnect eBay"}
            </button>
          </div>
        ) : (
          <a
            href="/api/ebay/auth"
            className="btn-primary inline-flex items-center gap-2 text-sm"
          >
            <Link2 className="w-4 h-4" />
            Connect eBay Account
          </a>
        )}
      </div>

      {/* ── Decision Rules ── */}
      <div className="card-panel">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-accent" />
            <h2 className="font-semibold">Decision Engine</h2>
          </div>
          <button
            className={rulesSaved ? "btn text-accent2" : "btn-primary text-xs"}
            onClick={saveDecisionRules}
          >
            {rulesSaved ? "Saved" : "Save Rules"}
          </button>
        </div>
        <p className="text-xs text-muted mb-4">
          Configure how the AI recommends actions for each scanned card. These thresholds
          determine when a card is flagged as Sell Fast, Sell Max, Grade, Hold, or Bulk Lot.
        </p>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">Bulk Lot Ceiling ($)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              className="input mt-1"
              value={decisionRules.bulkLotCeiling}
              onChange={(e) => patchRules({ bulkLotCeiling: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-[10px] text-muted mt-1">Cards at or below this price may show Bulk Lot</p>
          </div>
          <div>
            <label className="label">Sell Fast Ceiling ($)</label>
            <input
              type="number"
              step="0.50"
              min="0"
              className="input mt-1"
              value={decisionRules.sellFastCeiling}
              onChange={(e) => patchRules({ sellFastCeiling: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-[10px] text-muted mt-1">Cards between bulk lot and this price → Sell Fast</p>
          </div>
          <div>
            <label className="label">Grade Floor ($)</label>
            <input
              type="number"
              step="1"
              min="0"
              className="input mt-1"
              value={decisionRules.gradeFloor}
              onChange={(e) => patchRules({ gradeFloor: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-[10px] text-muted mt-1">Cards above this + good condition → suggest grading</p>
          </div>
          <div>
            <label className="label">Hold Floor ($)</label>
            <input
              type="number"
              step="5"
              min="0"
              className="input mt-1"
              value={decisionRules.holdFloor}
              onChange={(e) => patchRules({ holdFloor: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-[10px] text-muted mt-1">Foil cards above this may be worth holding</p>
          </div>
          <div>
            <label className="label">Min Condition for Grading</label>
            <select
              className="input mt-1"
              value={decisionRules.gradeMinCondition}
              onChange={(e) => patchRules({ gradeMinCondition: e.target.value as Condition })}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Estimated Grading Cost ($)</label>
            <input
              type="number"
              step="5"
              min="0"
              className="input mt-1"
              value={decisionRules.gradingCostUsd}
              onChange={(e) => patchRules({ gradingCostUsd: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="label">Graded Price Multiplier</label>
            <input
              type="number"
              step="0.1"
              min="1"
              className="input mt-1"
              value={decisionRules.gradeMultiplier}
              onChange={(e) => patchRules({ gradeMultiplier: parseFloat(e.target.value) || 1 })}
            />
            <p className="text-[10px] text-muted mt-1">Expected value after grading (2.0 = 2x current price)</p>
          </div>
        </div>

        <div className="flex gap-6 mt-4 pt-3 border-t border-border">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="accent-accent w-4 h-4"
              checked={decisionRules.enableBulkLot}
              onChange={(e) => patchRules({ enableBulkLot: e.target.checked })}
            />
            Show Bulk Lot recommendations
          </label>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="accent-accent w-4 h-4"
              checked={decisionRules.enableHold}
              onChange={(e) => patchRules({ enableHold: e.target.checked })}
            />
            Show Hold recommendations
          </label>
        </div>

        <button
          className="btn text-xs mt-3"
          onClick={() => {
            setDecisionRules({ ...DEFAULT_DECISION_RULES });
            setRulesSaved(false);
          }}
        >
          Reset to Defaults
        </button>
      </div>

      {/* ── Smart Pricing ── */}
      <div className="card-panel">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-accent" />
            <h2 className="font-semibold">Smart Pricing</h2>
          </div>
          <button
            className={pricingSaved ? "btn text-accent2" : "btn-primary text-xs"}
            onClick={savePricingConfig}
          >
            {pricingSaved ? "Saved" : "Save Pricing"}
          </button>
        </div>
        <p className="text-xs text-muted mb-4">
          Default pricing strategy applied to all cards. Can be overridden per batch.
        </p>

        {/* Strategy selector */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {(Object.keys(PRICING_STRATEGY_LABELS) as PricingStrategy[]).map((s) => (
            <button
              key={s}
              className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                pricingConfig.strategy === s
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-panel2 text-muted hover:text-white"
              }`}
              onClick={() => patchPricing({ strategy: s })}
            >
              <div className="font-medium">{PRICING_STRATEGY_LABELS[s]}</div>
              <div className="text-[10px] mt-0.5 opacity-70">{PRICING_STRATEGY_DESCRIPTIONS[s]}</div>
            </button>
          ))}
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          {(pricingConfig.strategy === "UNDERCUT" || pricingConfig.strategy === "VELOCITY") && (
            <div>
              <label className="label">
                {pricingConfig.strategy === "VELOCITY" ? "Quick Sell Discount (%)" : "Undercut (%)"}
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="50"
                className="input mt-1"
                value={pricingConfig.undercutPercent}
                onChange={(e) => patchPricing({ undercutPercent: parseInt(e.target.value) || 5 })}
              />
            </div>
          )}
          {pricingConfig.strategy === "MARKUP" && (
            <div>
              <label className="label">Markup (%)</label>
              <input
                type="number"
                step="1"
                min="1"
                max="200"
                className="input mt-1"
                value={pricingConfig.markupPercent}
                onChange={(e) => patchPricing({ markupPercent: parseInt(e.target.value) || 10 })}
              />
            </div>
          )}
          <div>
            <label className="label">Floor Price ($)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              className="input mt-1"
              value={pricingConfig.floorPrice}
              onChange={(e) => patchPricing({ floorPrice: parseFloat(e.target.value) || 0 })}
            />
          </div>
          <div>
            <label className="label">Ceiling Price ($)</label>
            <input
              type="number"
              step="5"
              min="0"
              className="input mt-1"
              value={pricingConfig.ceilingPrice}
              onChange={(e) => patchPricing({ ceilingPrice: parseFloat(e.target.value) || 0 })}
            />
            <p className="text-[10px] text-muted mt-1">0 = no ceiling</p>
          </div>
          <div>
            <label className="label">Rounding</label>
            <select
              className="input mt-1"
              value={pricingConfig.rounding}
              onChange={(e) => patchPricing({ rounding: e.target.value as RoundingRule })}
            >
              {(Object.entries(ROUNDING_LABELS) as [RoundingRule, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Minimum Margin ($)</label>
            <input
              type="number"
              step="0.25"
              min="0"
              className="input mt-1"
              value={pricingConfig.minimumMargin}
              onChange={(e) => patchPricing({ minimumMargin: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>

        <div className="flex gap-6 mt-4 pt-3 border-t border-border">
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="accent-accent w-4 h-4"
              checked={pricingConfig.applyToFoilsOnly}
              onChange={(e) => patchPricing({ applyToFoilsOnly: e.target.checked })}
            />
            Apply markup to foils only
          </label>
        </div>

        <button
          className="btn text-xs mt-3"
          onClick={() => {
            setPricingConfig({ ...DEFAULT_PRICING_CONFIG });
            setPricingSaved(false);
          }}
        >
          Reset to Defaults
        </button>
      </div>

      {/* ── Appearance ── */}
      <AppearanceSection />
    </div>
  );
}

function AppearanceSection() {
  const { mode, accent, setMode, setAccent } = useTheme();
  return (
    <div className="card-panel">
      <div className="flex items-center gap-2 mb-5">
        <Palette className="w-5 h-5 text-accent" />
        <h2 className="font-semibold">Appearance</h2>
      </div>
      <div className="grid sm:grid-cols-2 gap-6">
        {/* Theme mode */}
        <div>
          <label className="label">Theme</label>
          <div className="flex gap-2 mt-2">
            {(["dark", "light"] as ThemeMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors border ${
                  mode === m
                    ? "bg-accent/10 border-accent/30 text-accent"
                    : "bg-panel2 border-border text-muted hover:text-white"
                }`}
              >
                {m === "dark" ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                {m === "dark" ? "Dark" : "Light"}
              </button>
            ))}
          </div>
        </div>
        {/* Accent color */}
        <div>
          <label className="label">Accent Color</label>
          <div className="flex gap-2 mt-2 flex-wrap">
            {ACCENT_COLORS.map((c) => (
              <button
                key={c.key}
                onClick={() => setAccent(c.key)}
                className={`w-9 h-9 rounded-lg border-2 transition-all ${
                  accent === c.key
                    ? "border-white scale-110 shadow-lg"
                    : "border-transparent hover:border-border hover:scale-105"
                }`}
                style={{ background: c.swatch }}
                title={c.label}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
