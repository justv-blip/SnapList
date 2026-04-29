"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Zap,
  FileSpreadsheet,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  ScanLine,
  Loader2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TIER_LIMITS, TIER_LABELS } from "@/lib/tierLimits";

interface AccountInfo {
  name: string;
  tier: string;
  trialScansUsed: number;
  trialExpiresAt: string | null;
}

const STEPS = [
  {
    icon: Camera,
    step: "01",
    title: "Scan or upload",
    description:
      "Drop photos from your computer or use your phone camera live. Front and back photos are paired automatically.",
    color: "accent",
  },
  {
    icon: Zap,
    step: "02",
    title: "AI identifies the card",
    description:
      "Claude vision reads the card name, set code, and collector number in under 3 seconds — no manual typing.",
    color: "accent2",
  },
  {
    icon: FileSpreadsheet,
    step: "03",
    title: "Export & list everywhere",
    description:
      "Review your inventory, apply listing templates, and export to eBay, TCGPlayer, Whatnot, and more.",
    color: "accent",
  },
] as const;

const TIER_COLORS: Record<string, string> = {
  free: "bg-muted/20 text-muted border-muted/30",
  starter: "bg-accent/15 text-accent border-accent/30",
  pro: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  business: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  enterprise: "bg-amber-500/15 text-amber-400 border-amber-500/30",
};

export default function WelcomePage() {
  const router = useRouter();
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [completing, setCompleting] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) { router.replace("/login"); return; }

      const { data: p } = await supabase
        .from("profiles")
        .select("display_name, subscription_tier, trial_scans_used, trial_expires_at, has_onboarded")
        .eq("id", user.id)
        .single();

      // If already onboarded (e.g. direct URL visit), skip to dashboard
      if (p?.has_onboarded) { router.replace("/dashboard"); return; }

      setAccount({
        name: p?.display_name || user.email?.split("@")[0] || "there",
        tier: p?.subscription_tier || "free",
        trialScansUsed: p?.trial_scans_used || 0,
        trialExpiresAt: p?.trial_expires_at || null,
      });

      // Stagger entrance animation
      setTimeout(() => setVisible(true), 50);
    }
    load();
  }, [router]);

  const handleStart = async (destination: string) => {
    setCompleting(true);
    try {
      await fetch("/api/onboarding/complete", { method: "POST" });
    } catch { /* non-blocking */ }
    router.push(destination);
  };

  if (!account) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin" />
      </div>
    );
  }

  const tier = account.tier;
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const tierLabel = TIER_LABELS[tier] || tier;
  const isFree = tier === "free";

  // Trial expiry countdown
  let daysLeft: number | null = null;
  if (account.trialExpiresAt) {
    const diff = new Date(account.trialExpiresAt).getTime() - Date.now();
    daysLeft = Math.max(0, Math.ceil(diff / 86_400_000));
  }

  return (
    <div className="min-h-screen bg-bg flex flex-col">
      {/* Background glows */}
      <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-accent/[0.06] rounded-full blur-[140px]" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent2/[0.04] rounded-full blur-[120px]" />
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-5 py-16">
        <div
          className={`w-full max-w-2xl transition-all duration-700 ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
          }`}
        >
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-accent" />
            </div>
            <span className="text-xl font-bold tracking-tight">SnapList</span>
          </div>

          {/* Headline */}
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent2/10 border border-accent2/25 text-accent2 text-xs font-medium mb-5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Account created — you&apos;re in
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
              Welcome to SnapList,{" "}
              <span className="text-accent capitalize">{account.name}</span>
            </h1>
            <p className="text-muted text-base sm:text-lg leading-relaxed max-w-md mx-auto">
              Your AI-powered card scanning and listing workspace is ready.
              Here&apos;s what to do next.
            </p>
          </div>

          {/* Plan info banner */}
          <div className="mb-10 rounded-2xl border border-border bg-panel p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 border border-accent/25 flex items-center justify-center shrink-0">
                <ScanLine className="w-5 h-5 text-accent" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="font-semibold text-sm">Your plan</span>
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border uppercase tracking-wider ${
                      TIER_COLORS[tier] || TIER_COLORS.free
                    }`}
                  >
                    {tierLabel}
                  </span>
                </div>
                <p className="text-xs text-muted">
                  {isFree ? (
                    <>
                      <strong className="text-foreground">{limit - account.trialScansUsed} scans</strong>{" "}
                      remaining in your free trial
                      {daysLeft !== null && (
                        <> &middot; <strong className="text-foreground">{daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong> left</>
                      )}
                    </>
                  ) : (
                    <>
                      <strong className="text-foreground">{limit.toLocaleString()} scans</strong>{" "}
                      available per month
                    </>
                  )}
                </p>
              </div>
            </div>
            {isFree && (
              <button
                onClick={() => handleStart("/settings")}
                className="text-xs text-accent hover:underline shrink-0 font-medium"
              >
                View upgrade options →
              </button>
            )}
          </div>

          {/* Steps */}
          <div className="grid sm:grid-cols-3 gap-4 mb-10">
            {STEPS.map((s, i) => (
              <div
                key={s.step}
                className={`rounded-2xl border border-border bg-panel p-5 transition-all duration-700 ${
                  visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
                }`}
                style={{ transitionDelay: `${150 + i * 80}ms` }}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      s.color === "accent2"
                        ? "bg-accent2/10 border border-accent2/25"
                        : "bg-accent/10 border border-accent/25"
                    }`}
                  >
                    <s.icon
                      className={`w-4.5 h-4.5 ${
                        s.color === "accent2" ? "text-accent2" : "text-accent"
                      }`}
                    />
                  </div>
                  <span className="text-[10px] font-semibold text-muted tracking-widest uppercase">
                    Step {s.step}
                  </span>
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{s.title}</h3>
                <p className="text-xs text-muted leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div
            className={`flex flex-col sm:flex-row items-center justify-center gap-3 transition-all duration-700 ${
              visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: "400ms" }}
          >
            <button
              onClick={() => handleStart("/scan")}
              disabled={completing}
              className="btn-primary text-base px-8 py-3.5 shadow-lg shadow-accent/25 disabled:opacity-60 w-full sm:w-auto justify-center"
            >
              {completing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <ScanLine className="w-4 h-4" />
                  Start scanning
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
            <button
              onClick={() => handleStart("/dashboard")}
              disabled={completing}
              className="btn text-sm px-6 py-3 w-full sm:w-auto justify-center disabled:opacity-60"
            >
              Go to dashboard
            </button>
          </div>

          {/* Footer note */}
          <p
            className={`text-center text-xs text-muted mt-8 transition-all duration-700 ${
              visible ? "opacity-100" : "opacity-0"
            }`}
            style={{ transitionDelay: "500ms" }}
          >
            You can revisit this guide anytime in{" "}
            <button
              onClick={() => handleStart("/guide")}
              className="text-accent hover:underline"
            >
              Help &amp; Guide
            </button>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
