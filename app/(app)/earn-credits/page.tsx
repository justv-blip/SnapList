"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Gift,
  Star,
  Video,
  ExternalLink,
  CheckCircle2,
  TrendingUp,
  Eye,
  ThumbsUp,
  Loader2,
  Scan,
} from "lucide-react";

interface CreditProgram {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  credits: string;
  description: string;
  details: string[];
  action: string;
}

const PROGRAMS: CreditProgram[] = [
  {
    icon: Star,
    title: "Leave a Review",
    credits: "100 credits",
    description:
      "Share your experience with SnapList. Leave an honest review on the App Store, Google Play, or Trustpilot and earn 100 credits.",
    details: [
      "One review per platform (up to 300 credits total)",
      "Review must be at least 3 sentences",
      "Submit a screenshot of your review for verification",
      "Credits awarded within 24 hours of approval",
    ],
    action: "Submit Review",
  },
  {
    icon: Video,
    title: "Social Media Video",
    credits: "100 – 5,000 credits",
    description:
      "Create a video about SnapList on YouTube, TikTok, Instagram, or X. Credits scale with quality, content, and viewership.",
    details: [
      "Minimum 30 seconds, must show SnapList in use",
      "Must tag @snaplistapp and include link in description",
      "100 credits base for any qualifying video",
      "Up to 500 credits for high-quality production",
      "Up to 2,000 credits for 1K+ views",
      "Up to 5,000 credits for viral content (10K+ views, high engagement)",
    ],
    action: "Submit Video",
  },
];

const CREDIT_TIERS = [
  { views: "Any qualifying video", credits: "100", icon: Video },
  { views: "High-quality production", credits: "Up to 500", icon: ThumbsUp },
  { views: "1,000+ views", credits: "Up to 2,000", icon: Eye },
  { views: "10,000+ views + engagement", credits: "Up to 5,000", icon: TrendingUp },
];

export default function EarnCreditsPage() {
  const [expandedProgram, setExpandedProgram] = useState<number | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [loadingCredits, setLoadingCredits] = useState(true);

  useEffect(() => {
    fetch("/api/credits/balance")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setCredits(d?.credits ?? 0))
      .catch(() => setCredits(0))
      .finally(() => setLoadingCredits(false));
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Earn Credits</h1>
        <p className="text-sm text-muted mt-1">
          Get free scan credits by sharing SnapList with the community
        </p>
      </div>

      {/* Credits balance */}
      <div className="card-panel bg-accent/5 border-accent/20">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
              <Gift className="w-6 h-6 text-accent" />
            </div>
            <div>
              <p className="text-xs text-muted uppercase tracking-wider font-medium">Your Credits</p>
              {loadingCredits ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted mt-1" />
              ) : (
                <p className="text-2xl font-bold">
                  {credits?.toLocaleString()}{" "}
                  <span className="text-sm font-normal text-muted">credits</span>
                </p>
              )}
            </div>
          </div>
          {!loadingCredits && credits !== null && credits > 0 && (
            <div className="flex items-center gap-2 text-xs text-accent2 bg-accent2/10 border border-accent2/20 rounded-lg px-3 py-2">
              <Scan className="w-3.5 h-3.5 shrink-0" />
              <span>= <strong>{credits}</strong> bonus scan{credits !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
        <p className="text-xs text-muted mt-3">
          1 credit = 1 bonus scan on top of your plan quota. Credits never expire.
        </p>
      </div>

      {/* Programs */}
      <div className="space-y-4">
        {PROGRAMS.map((program, i) => (
          <div key={program.title} className="card-panel">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                <program.icon className="w-5 h-5 text-accent" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="font-semibold">{program.title}</h2>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-accent/10 border border-accent/30 text-accent">
                    <Gift className="w-3 h-3" />
                    {program.credits}
                  </span>
                </div>
                <p className="text-sm text-muted mt-2 leading-relaxed">{program.description}</p>

                <button
                  className="text-xs text-accent mt-3 hover:underline"
                  onClick={() => setExpandedProgram(expandedProgram === i ? null : i)}
                >
                  {expandedProgram === i ? "Hide details" : "View requirements"}
                </button>

                {expandedProgram === i && (
                  <ul className="mt-3 space-y-2">
                    {program.details.map((detail) => (
                      <li key={detail} className="flex items-start gap-2 text-sm text-muted">
                        <CheckCircle2 className="w-3.5 h-3.5 text-accent2 shrink-0 mt-0.5" />
                        {detail}
                      </li>
                    ))}
                  </ul>
                )}

                <Link
                  href="/contact?topic=credits"
                  className="btn-primary mt-4 text-xs inline-flex items-center gap-1.5"
                >
                  {program.action}
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Video credit tiers */}
      <div className="card-panel">
        <h3 className="font-semibold mb-4">Video Credit Tiers</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {CREDIT_TIERS.map((tier) => (
            <div
              key={tier.views}
              className="flex items-center gap-3 p-3 rounded-lg bg-panel2 border border-border"
            >
              <tier.icon className="w-4 h-4 text-accent shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted">{tier.views}</p>
                <p className="text-sm font-semibold text-accent">{tier.credits} credits</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* How it works */}
      <div className="card-panel">
        <h3 className="font-semibold mb-3">How It Works</h3>
        <div className="space-y-3">
          {[
            { step: "1", text: "Complete one of the earn opportunities above" },
            { step: "2", text: "Submit proof (screenshot or link) via the form" },
            { step: "3", text: "We review your submission within 24–48 hours" },
            { step: "4", text: "Credits appear in your balance automatically — each one adds a bonus scan" },
          ].map((item) => (
            <div key={item.step} className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 text-xs font-bold text-accent">
                {item.step}
              </div>
              <p className="text-sm text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
