"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { CreditCard, Package, Award, Upload } from "lucide-react";
import Scanner from "@/components/Scanner";
import SealedScanner from "@/components/SealedScanner";
import GradedScanner from "@/components/GradedScanner";
import ImportModal from "@/components/ImportModal";

type ScanMode = "cards" | "sealed" | "graded";

function ScanContent() {
  const params = useSearchParams();
  const router = useRouter();
  const batchId = params.get("batch") || undefined;

  const [mode, setMode] = useState<ScanMode>("cards");
  const [showImport, setShowImport] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {batchId ? "Review Batch" : "Scan"}
          </h1>
          <p className="text-sm text-muted mt-1">
            {batchId
              ? "Review, edit, and export this batch"
              : "Scan cards, sealed products, and graded slabs — prices pulled automatically"}
          </p>
        </div>
        {!batchId && (
          <button
            className="btn shrink-0 text-xs flex items-center gap-2"
            onClick={() => setShowImport(true)}
            title="Bulk import cards from a CSV file"
          >
            <Upload className="w-4 h-4" />
            CSV Import
          </button>
        )}
      </div>

      {showImport && (
        <ImportModal
          onClose={() => setShowImport(false)}
          onImported={(result) => {
            setShowImport(false);
            router.push(`/scan?batch=${result.batchId}`);
          }}
        />
      )}

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
        </div>
      )}

      {/* Content */}
      {mode === "cards" ? (
        <Scanner batchId={batchId} />
      ) : mode === "sealed" ? (
        <SealedScanner />
      ) : (
        <GradedScanner />
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
