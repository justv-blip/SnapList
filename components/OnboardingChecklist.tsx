"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, Circle, X, ScanLine, ListChecks, Download } from "lucide-react";

interface OnboardingProps {
  metrics: {
    totalCards: number;
    readyBatches: number;
    listedBatches: number;
    listedOnEbay: number;
  };
}

const STORAGE_KEY = "snaplist_onboarding_dismissed";

export default function OnboardingChecklist({ metrics }: OnboardingProps) {
  const [dismissed, setDismissed] = useState(true); // start dismissed to avoid flash

  useEffect(() => {
    const val = localStorage.getItem(STORAGE_KEY);
    setDismissed(val === "true");
  }, []);

  const step1 = metrics.totalCards > 0;
  const step2 = metrics.readyBatches + metrics.listedBatches > 0;
  const step3 = metrics.listedOnEbay > 0;
  const allDone = step1 && step2 && step3;

  // Auto-dismiss when all steps complete
  useEffect(() => {
    if (allDone) {
      localStorage.setItem(STORAGE_KEY, "true");
      setDismissed(true);
    }
  }, [allDone]);

  if (dismissed) return null;

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, "true");
    setDismissed(true);
  };

  const steps: Array<{
    done: boolean;
    label: string;
    sub: string;
    href: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    {
      done: step1,
      label: "Scan your first card",
      sub: "Upload a photo or use the live camera",
      href: "/scan",
      icon: ScanLine,
    },
    {
      done: step2,
      label: "Review a batch",
      sub: "Check prices, conditions, and AI suggestions",
      href: "/scan",
      icon: ListChecks,
    },
    {
      done: step3,
      label: "Export your first listing",
      sub: "Download an eBay or TCGplayer CSV",
      href: "/collection",
      icon: Download,
    },
  ];

  const completedCount = steps.filter((s) => s.done).length;

  return (
    <div className="card-panel border-accent/30 bg-accent/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">Getting Started</span>
          <span className="text-xs text-muted">{completedCount} of 3 complete</span>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1 text-muted hover:text-foreground transition-colors rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 rounded-full bg-panel2 mb-4 overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${(completedCount / 3) * 100}%` }}
        />
      </div>
      <div className="grid sm:grid-cols-3 gap-3">
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <Link
              key={i}
              href={step.href}
              className={`flex items-start gap-3 p-3 rounded-xl border transition-colors ${
                step.done
                  ? "bg-accent2/8 border-accent2/20 cursor-default pointer-events-none"
                  : "bg-panel2 border-border hover:border-accent/40"
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {step.done ? (
                  <CheckCircle2 className="w-5 h-5 text-accent2" />
                ) : (
                  <Circle className="w-5 h-5 text-muted" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-semibold ${step.done ? "text-accent2" : "text-foreground"}`}>
                  {step.label}
                </p>
                <p className="text-[10px] text-muted mt-0.5 leading-relaxed">{step.sub}</p>
              </div>
              <div className="shrink-0 mt-0.5 opacity-0">
                {/* spacer so Icon doesn't affect layout — actual icon for screen-reader only */}
                <Icon className="w-4 h-4" aria-hidden="true" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
