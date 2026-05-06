"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CreditCard, Package } from "lucide-react";
import Scanner from "@/components/Scanner";
import SealedScanner from "@/components/SealedScanner";

type ScanMode = "cards" | "sealed";

function ScanContent() {
  const params = useSearchParams();
  const batchId = params.get("batch") || undefined;

  // If a batchId is provided, go straight to card scanner (batch review)
  const [mode, setMode] = useState<ScanMode>(batchId ? "cards" : "cards");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {batchId ? "Review Batch" : "Scan"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {batchId
            ? "Review, edit, and export this batch"
            : "Identify cards and sealed products — prices pulled automatically"}
        </p>
      </div>

      {/* Mode toggle — hidden when reviewing a specific batch */}
      {!batchId && (
        <div className="flex gap-2 p-1 rounded-xl bg-surface-2 border border-border w-fit">
          <button
            onClick={() => setMode("cards")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "cards"
                ? "bg-brand text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <CreditCard className="w-4 h-4" />
            Cards
          </button>
          <button
            onClick={() => setMode("sealed")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "sealed"
                ? "bg-brand text-white shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Package className="w-4 h-4" />
            Sealed Products
          </button>
        </div>
      )}

      {/* Content */}
      {mode === "cards" ? (
        <Scanner batchId={batchId} />
      ) : (
        <SealedScanner />
      )}
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense>
      <ScanContent />
    </Suspense>
  );
}
