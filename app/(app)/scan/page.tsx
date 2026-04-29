"use client";

import { useSearchParams } from "next/navigation";
import Scanner from "@/components/Scanner";

export default function ScanPage() {
  const params = useSearchParams();
  const batchId = params.get("batch") || undefined;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          {batchId ? "Review Batch" : "Scan Cards"}
        </h1>
        <p className="text-sm text-muted mt-1">
          {batchId
            ? "Review, edit, and export this batch"
            : "Upload photos or use the camera to identify and catalog your cards"}
        </p>
      </div>
      <Scanner batchId={batchId} />
    </div>
  );
}
