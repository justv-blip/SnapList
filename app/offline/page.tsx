// Served by the service worker when navigation fails due to no network.
// Must be pre-cached in sw.js so it's available when offline.

"use client";

import { WifiOff, RefreshCw } from "lucide-react";

export default function OfflinePage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-xs">
        <div className="w-16 h-16 rounded-2xl bg-panel border border-border flex items-center justify-center mx-auto mb-6">
          <WifiOff className="w-8 h-8 text-muted" />
        </div>
        <h1 className="text-xl font-bold mb-2">You&apos;re offline</h1>
        <p className="text-sm text-muted mb-8">
          SnapList needs a connection to scan cards and fetch prices. Check your network and try again.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="btn-primary inline-flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try again
        </button>
      </div>
    </div>
  );
}
