"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Camera, X, ScanLine, RefreshCw } from "lucide-react";
import type { SealedScanResult, SealedCondition } from "@/lib/types";
import SealedResultCard from "./SealedResultCard";

type InputMode = "upload" | "camera";

// Resize an image file client-side before sending (reduces payload, speeds up API)
async function prepareImageFile(file: File): Promise<File> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1280;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        if (width > height) {
          height = Math.round((height * MAX) / width);
          width = MAX;
        } else {
          width = Math.round((width * MAX) / height);
          height = MAX;
        }
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

export default function SealedScanner() {
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [preview, setPreview] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<SealedScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ── File selection ──────────────────────────────────────────────────────────
  const handleFile = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file.");
      return;
    }
    setError(null);
    setResult(null);
    const url = URL.createObjectURL(file);
    setPreview(url);
    setSelectedFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  // ── Drag-and-drop ───────────────────────────────────────────────────────────
  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onDragOver = (e: React.DragEvent<HTMLDivElement>) => e.preventDefault();

  // ── Scan ────────────────────────────────────────────────────────────────────
  const runScan = async () => {
    if (!selectedFile) return;
    setScanning(true);
    setError(null);
    setResult(null);

    try {
      const prepared = await prepareImageFile(selectedFile);
      const form = new FormData();
      form.append("image", prepared);

      const res = await fetch("/api/scan-sealed", { method: "POST", body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Scan failed. Please try again.");
        return;
      }

      setResult(data.result as SealedScanResult);
    } catch {
      setError("Network error — please check your connection and try again.");
    } finally {
      setScanning(false);
    }
  };

  // ── Reset ───────────────────────────────────────────────────────────────────
  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setSelectedFile(null);
    setResult(null);
    setError(null);
  };

  // ── Save to collection ──────────────────────────────────────────────────────
  const handleSave = async (updatedResult: SealedScanResult) => {
    setSaving(true);
    try {
      const res = await fetch("/api/sealed-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatedResult),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Failed to save to collection.");
        return;
      }
      // Reset after save
      reset();
    } catch {
      setError("Failed to save — please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setInputMode("upload"); reset(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            inputMode === "upload"
              ? "bg-brand text-white border-brand"
              : "bg-surface-2 text-muted border-border hover:border-brand/50"
          }`}
        >
          <Upload className="w-4 h-4" />
          Upload
        </button>
        <button
          onClick={() => { setInputMode("camera"); reset(); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
            inputMode === "camera"
              ? "bg-brand text-white border-brand"
              : "bg-surface-2 text-muted border-border hover:border-brand/50"
          }`}
        >
          <Camera className="w-4 h-4" />
          Camera
        </button>
      </div>

      {/* Image area */}
      {!preview ? (
        inputMode === "upload" ? (
          <div
            ref={dropRef}
            onDrop={onDrop}
            onDragOver={onDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="relative border-2 border-dashed border-border hover:border-brand/60 rounded-xl bg-surface-2 transition-colors cursor-pointer"
          >
            <div className="flex flex-col items-center gap-3 py-14 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <Upload className="w-6 h-6 text-brand" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Drop image here or click to browse</p>
                <p className="text-xs text-muted mt-1">JPG, PNG, WEBP · Max 10 MB</p>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        ) : (
          <div
            onClick={() => cameraInputRef.current?.click()}
            className="relative border-2 border-dashed border-border hover:border-brand/60 rounded-xl bg-surface-2 transition-colors cursor-pointer"
          >
            <div className="flex flex-col items-center gap-3 py-14 px-6 text-center">
              <div className="w-12 h-12 rounded-full bg-brand/10 flex items-center justify-center">
                <Camera className="w-6 h-6 text-brand" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Tap to open camera</p>
                <p className="text-xs text-muted mt-1">Point at the front of the box or pack</p>
              </div>
            </div>
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileInput}
            />
          </div>
        )
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-border bg-surface-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Selected product"
            className="w-full max-h-80 object-contain"
          />
          <button
            onClick={reset}
            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            aria-label="Remove image"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <X className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Scan / Rescan button */}
      {selectedFile && !scanning && !result && (
        <button
          onClick={runScan}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-brand text-white text-sm font-semibold hover:bg-brand/90 transition-colors"
        >
          <ScanLine className="w-4 h-4" />
          Identify Sealed Product
        </button>
      )}

      {scanning && (
        <div className="w-full flex items-center justify-center gap-3 py-3 rounded-xl bg-brand/10 border border-brand/20 text-brand text-sm font-medium">
          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Scanning product…
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="space-y-3">
          <SealedResultCard
            result={result}
            onConditionChange={(condition) => {
              setResult((r) => r ? { ...r, condition } : r);
            }}
            onSave={handleSave}
            saving={saving}
          />
          <button
            onClick={() => { setResult(null); }}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-border bg-surface-2 text-sm text-muted hover:text-foreground hover:border-brand/50 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Scan Again
          </button>
        </div>
      )}

      {/* Tips */}
      {!selectedFile && !result && (
        <div className="rounded-lg bg-surface-2 border border-border p-4">
          <p className="text-xs font-semibold text-muted uppercase tracking-wider mb-2">Tips for best results</p>
          <ul className="space-y-1.5 text-xs text-muted">
            <li className="flex items-start gap-1.5">
              <span className="text-brand mt-0.5">•</span>
              Lay the product flat with the front face clearly visible
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-brand mt-0.5">•</span>
              Make sure the product name and set logo are in frame
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-brand mt-0.5">•</span>
              Good lighting — avoid harsh shadows across the text
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-brand mt-0.5">•</span>
              For edition detection, include any "1st Edition" stamps in the shot
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
