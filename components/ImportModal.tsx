"use client";

import { useCallback, useRef, useState } from "react";
import {
  Upload,
  X,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ArrowRight,
  Download,
} from "lucide-react";

// ─── CSV parser (no dependencies) ─────────────────────────────────────────────

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  if (lines.length < 2) return [];

  // Simple RFC 4180 parser
  function splitRow(line: string): string[] {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = !inQuotes; }
      } else if (ch === "," && !inQuotes) {
        cells.push(cur.trim()); cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  }

  const headers = splitRow(lines[0]).map((h) => h.replace(/^"|"$/g, "").trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const cells = splitRow(line);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = cells[idx] ?? ""; });
    rows.push(row);
  }

  return rows;
}

// ─── Sample CSV template ───────────────────────────────────────────────────────

const CSV_TEMPLATE = `name,game,set_name,condition,quantity,price,foil,language,notes,sku
Charizard Holo,pokemon,Base Set,Near Mint,1,450.00,false,English,,
Black Lotus,mtg,Alpha,Lightly Played,1,8000.00,false,English,,
Dark Magician,yugioh,LOB-EN005,Near Mint,2,15.00,false,English,,`;

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "snaplist-import-template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ImportResult {
  batchId: string;
  batchName: string;
  imported: number;
  skipped: number;
}

interface Props {
  onClose: () => void;
  onImported: (result: ImportResult) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

type Step = "upload" | "preview" | "importing" | "done";

export default function ImportModal({ onClose, onImported }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [batchName, setBatchName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // ── File handling ──────────────────────────────────────────────────────────

  const processFile = useCallback((file: File) => {
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      setError("Please upload a .csv file.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("File too large. Maximum 5 MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCsv(text);
      if (parsed.length === 0) {
        setError("No rows found. Check the file has a header row and at least one data row.");
        return;
      }
      if (parsed.length > 2000) {
        setError("Too many rows (max 2,000 per import). Split your file and import in batches.");
        return;
      }
      // Check required column
      if (!Object.keys(parsed[0]).some((k) =>
        ["name", "Name", "card name", "Card Name", "Card"].includes(k)
      )) {
        setError('Missing required column: "name" (or "Card Name"). Check your CSV headers.');
        return;
      }
      setRows(parsed);
      setFileName(file.name);
      setBatchName(`CSV Import — ${file.name.replace(".csv", "")}`);
      setError(null);
      setStep("preview");
    };
    reader.readAsText(file);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  // ── Import ─────────────────────────────────────────────────────────────────

  const runImport = async () => {
    setStep("importing");
    setError(null);
    try {
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, batchName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Import failed.");
        setStep("preview");
        return;
      }
      setResult(data);
      setStep("done");
      onImported(data);
    } catch {
      setError("Network error — please try again.");
      setStep("preview");
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  // Column preview (first 5 rows, up to 6 columns)
  const previewHeaders = rows.length > 0
    ? Object.keys(rows[0]).slice(0, 6)
    : [];
  const previewRows = rows.slice(0, 5);

  const hasName = rows.length > 0 && Object.keys(rows[0]).some((k) =>
    ["name", "Name", "card name", "Card Name"].includes(k)
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-panel border border-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-base">Bulk CSV Import</h2>
            <p className="text-xs text-muted mt-0.5">
              Import up to 2,000 cards from a spreadsheet
            </p>
          </div>
          <button onClick={onClose} className="btn p-1.5">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* ── UPLOAD STEP ─────────────────────────────────────────── */}
          {step === "upload" && (
            <>
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
                  dragging
                    ? "border-accent bg-accent/5"
                    : "border-border hover:border-accent/50 hover:bg-panel2"
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-muted mx-auto mb-3" />
                <p className="font-medium text-sm">Drag & drop a CSV file here</p>
                <p className="text-xs text-muted mt-1">or click to browse</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processFile(f);
                    e.target.value = "";
                  }}
                />
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              {/* Required format */}
              <div className="card-panel p-4 text-sm space-y-2">
                <p className="font-medium">Required column: <code className="text-accent">name</code></p>
                <p className="text-xs text-muted leading-relaxed">
                  Optional: <code>game</code>, <code>set_name</code>, <code>condition</code>,{" "}
                  <code>quantity</code>, <code>price</code>, <code>foil</code>, <code>language</code>,{" "}
                  <code>notes</code>, <code>sku</code>
                </p>
                <p className="text-xs text-muted">
                  Accepted condition values: NM, LP, MP, HP, DMG (or full names). Game values: pokemon, mtg, yugioh, lorcana, etc.
                </p>
              </div>

              {/* Template download */}
              <button
                className="btn text-xs flex items-center gap-2"
                onClick={downloadTemplate}
              >
                <Download className="w-4 h-4" />
                Download CSV template
              </button>
            </>
          )}

          {/* ── PREVIEW STEP ─────────────────────────────────────────── */}
          {(step === "preview" || step === "importing") && rows.length > 0 && (
            <>
              <div className="flex items-center gap-3">
                <FileText className="w-5 h-5 text-accent shrink-0" />
                <div>
                  <p className="text-sm font-medium">{fileName}</p>
                  <p className="text-xs text-muted">
                    {rows.length.toLocaleString()} rows detected
                    {!hasName && (
                      <span className="text-amber-400 ml-2">⚠ No "name" column found</span>
                    )}
                  </p>
                </div>
                <button
                  className="ml-auto text-xs text-muted hover:text-foreground underline"
                  onClick={() => { setStep("upload"); setRows([]); setError(null); }}
                >
                  Change file
                </button>
              </div>

              {/* Batch name */}
              <div>
                <label className="label">Batch name</label>
                <input
                  className="input mt-1"
                  value={batchName}
                  onChange={(e) => setBatchName(e.target.value)}
                  placeholder="CSV Import"
                />
              </div>

              {/* Preview table */}
              <div>
                <p className="text-xs text-muted mb-2">
                  Preview (first {Math.min(5, rows.length)} of {rows.length} rows)
                </p>
                <div className="overflow-x-auto rounded-lg border border-border">
                  <table className="w-full text-xs">
                    <thead className="bg-panel2">
                      <tr>
                        {previewHeaders.map((h) => (
                          <th key={h} className="px-3 py-2 text-left font-medium text-muted">
                            {h}
                          </th>
                        ))}
                        {previewHeaders.length < Object.keys(rows[0] ?? {}).length && (
                          <th className="px-3 py-2 text-left text-muted">
                            +{Object.keys(rows[0]).length - previewHeaders.length} more…
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-t border-border">
                          {previewHeaders.map((h) => (
                            <td key={h} className="px-3 py-2 text-muted truncate max-w-[120px]">
                              {row[h] || <span className="opacity-30">—</span>}
                            </td>
                          ))}
                          {previewHeaders.length < Object.keys(row).length && (
                            <td className="px-3 py-2 text-muted opacity-40">…</td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2 text-sm text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  {error}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={runImport}
                  disabled={step === "importing" || !hasName}
                >
                  {step === "importing" ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Importing…
                    </>
                  ) : (
                    <>
                      <ArrowRight className="w-4 h-4" />
                      Import {rows.length.toLocaleString()} cards
                    </>
                  )}
                </button>
                <button className="btn" onClick={onClose} disabled={step === "importing"}>
                  Cancel
                </button>
              </div>
            </>
          )}

          {/* ── DONE STEP ─────────────────────────────────────────────── */}
          {step === "done" && result && (
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">Import complete!</h3>
                <p className="text-sm text-muted mt-1">
                  <span className="font-semibold text-foreground">{result.imported.toLocaleString()}</span> cards
                  imported into <span className="font-medium text-accent">"{result.batchName}"</span>
                  {result.skipped > 0 && (
                    <span className="text-amber-400"> · {result.skipped} rows skipped (missing name)</span>
                  )}
                </p>
              </div>
              <div className="flex gap-3">
                <a
                  href={`/scan?batch=${result.batchId}`}
                  className="btn-primary text-sm flex items-center gap-2"
                >
                  Review Batch
                  <ArrowRight className="w-4 h-4" />
                </a>
                <button className="btn text-sm" onClick={onClose}>
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
