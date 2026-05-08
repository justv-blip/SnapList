"use client";

// InstallPrompt — surfaces the browser's "Add to Home Screen" banner.
//
// How it works:
//   Chrome fires `beforeinstallprompt` when the PWA install criteria are met.
//   We intercept and hold the event, then show our own styled banner so the
//   call-to-action fits the app's design instead of the generic browser UI.
//
// The banner:
//   - Appears at the bottom of the screen (above the mobile nav area)
//   - Remembers dismissal via localStorage so it doesn't reappear
//   - Is hidden automatically once installed (appinstalled event)
//   - Falls through gracefully on iOS (no beforeinstallprompt support)

import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISSED_KEY = "pwa-install-dismissed";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed
    try {
      if (localStorage.getItem(DISMISSED_KEY)) return;
    } catch { /* ignore */ }

    // Don't show if already running as a standalone PWA
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Hide once the app is installed
    window.addEventListener("appinstalled", () => setVisible(false));

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    setInstalling(true);
    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setVisible(false);
      }
    } catch {
      // User cancelled or prompt failed — silently ignore
    } finally {
      setInstalling(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISSED_KEY, "1");
    } catch { /* ignore */ }
  };

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-20 left-4 right-4 z-40 md:left-auto md:right-6 md:bottom-6 md:w-80"
      role="banner"
      aria-label="Install SnapList app"
    >
      <div className="bg-panel border border-border rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shrink-0">
          <Download className="w-5 h-5 text-brand" />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold leading-tight">Install SnapList</p>
          <p className="text-xs text-muted mt-0.5 leading-relaxed">
            Add to your home screen for faster scanning — works offline too.
          </p>
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              disabled={installing}
              className="btn-primary text-xs px-3 py-1.5"
            >
              {installing ? "Installing…" : "Install"}
            </button>
            <button
              onClick={handleDismiss}
              className="btn text-xs px-3 py-1.5"
            >
              Not now
            </button>
          </div>
        </div>

        {/* Close */}
        <button
          onClick={handleDismiss}
          className="text-muted hover:text-foreground shrink-0 mt-0.5"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
