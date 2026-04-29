"use client";

import { useCallback, useRef, useState } from "react";
import { Upload, Loader2, ImagePlus } from "lucide-react";

interface Props {
  onFiles: (files: File[]) => void;
  busy: boolean;
  scanCount?: number;
}

export default function UploadDropzone({ onFiles, busy, scanCount }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const pickFiles = useCallback(() => {
    if (!busy) inputRef.current?.click();
  }, [busy]);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) onFiles(files);
    // Reset so the same file can be chosen again.
    e.target.value = "";
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (busy) return;
    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/")
    );
    if (files.length) onFiles(files);
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={onDrop}
      onClick={pickFiles}
      role="button"
      tabIndex={0}
      className={`group cursor-pointer rounded-xl border-2 border-dashed transition-colors min-h-[220px] flex flex-col items-center justify-center px-6 py-10 text-center ${
        isDragging
          ? "border-accent bg-accent/5"
          : "border-border hover:border-accent/60 hover:bg-panel2"
      } ${busy ? "pointer-events-none opacity-80" : ""}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={onChange}
      />
      {busy ? (
        <>
          <Loader2 className="w-8 h-8 animate-spin text-accent mb-3" />
          <p className="font-medium">
            Scanning{scanCount ? ` ${scanCount} image${scanCount !== 1 ? "s" : ""}` : ""}…
          </p>
          <p className="text-sm text-muted mt-1">
            AI is identifying your card{scanCount && scanCount > 1 ? "s" : ""} — usually a few seconds each.
          </p>
        </>
      ) : (
        <>
          <div className="w-12 h-12 rounded-full bg-panel2 border border-border flex items-center justify-center mb-3 group-hover:bg-panel">
            <Upload className="w-5 h-5 text-accent" />
          </div>
          <p className="font-medium">Drop card photos here or click to upload</p>
          <p className="text-sm text-muted mt-1">
            JPEG, PNG, or WEBP. You can upload many at once.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted">
            <ImagePlus className="w-4 h-4" />
            Tip: well-lit, flat, centered photos work best.
          </div>
        </>
      )}
    </div>
  );
}
