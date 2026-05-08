"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { CreditCard, Package, Award, Upload } from "lucide-react";
import Scanner from "@/components/Scanner";
import SealedScanner from "@/components/SealedScanner";
import GradedScanner from "@/components/GradedScanner";
import ImportModal from "@/components/ImportModal";

type ScanMode = "cards" | "sealed" | "graded" | "import";

function ScanContent() {
  const params = useSearchParams();
  const router = useRouter();
  const batchId = params.get("batch") || undefined;

  const [mode, setMode] = useState<ScanMode>("cards");

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          {batchId && (
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-foreground mb-2 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Back to Dashboard
            </Link>
          )}
          <h1 className="text-2xl font-bold tracking-tight">
            {batchId ? "Review Batch" : "Scan"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {batchId
              ? "Review, edit, and export this batch"
              : "Scan cards, sealed products, and graded slabs — prices pulled automatically"}
          </p>
        </div>
      </div>

      {/* Mode toggle — hidden when reviewing a specific batch */}
      {!batchId && (
        <div className="flex gap-2 p-1 rounded-xl bg-surface-2 border border-border w-fit flex-wrap">
          <button
            onClick={() => setMode("cards")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "cards"
                ? "bg-accent text-black shadow-sm"
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
                ? "bg-accent text-black shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Package className="w-4 h-4" />
            Sealed
          </button>
          <button
            onClick={() => setMode("graded")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "graded"
                ? "bg-amber-500 text-black shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Award className="w-4 h-4" />
            Graded
          </button>
          {/* CSV Import — first-class mode, not a hidden header button */}
          <button
            onClick={() => setMode("import")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              mode === "import"
                ? "bg-panel border border-border text-foreground shadow-sm"
                : "text-muted hover:text-foreground"
            }`}
          >
            <Upload className="w-4 h-4" />
            CSV Import
          </button>
        </div>
      )}

      {/* Content */}
      {mode === "cards" ? (
        <Scanner batchId={batchId} />
      ) : mode === "sealed" ? (
        <SealedScanner />
      ) : mode === "graded" ? (
        <GradedScanner />
      ) : (
        <ImportModal
          inline
          onClose={() => setMode("cards")}
          onImported={(result) => {
            router.push(`/scan?batch=${result.batchId}`);
          }}
        />
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
