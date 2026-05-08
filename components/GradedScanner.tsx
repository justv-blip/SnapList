"use client";

import { useState } from "react";
import { v4 as uuid } from "uuid";
import {
  Award,
  ShieldCheck,
  ShieldAlert,
  Loader2,
  Search,
  CheckCircle2,
  RefreshCw,
  Download,
  Users,
  Tag,
  Calendar,
  DollarSign,
} from "lucide-react";
import {
  type Game,
  type GradingCompany,
  GAME_LABELS,
  GAMES,
  GRADING_COMPANIES,
  GRADING_COMPANY_LABELS,
} from "@/lib/types";
import type { ScannedCard } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GradeLookupResult {
  verified: boolean;
  grade?: string;
  label?: string;
  population?: number;
  subgrades?: Record<string, string>;
  cardName?: string;
  year?: string;
  setName?: string;
  error?: string;
}

interface GradedPriceResult {
  found: boolean;
  marketPriceUsd?: number;
  sampleSize?: number;
  priceSource?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function gradeColor(company: GradingCompany, grade: string): string {
  const num = parseFloat(grade);
  if (isNaN(num)) return "text-amber-400";
  if (num >= 9.5) return "text-emerald-400";
  if (num >= 8) return "text-blue-400";
  if (num >= 6) return "text-amber-400";
  return "text-red-400";
}

function buildScannedCard(
  company: GradingCompany,
  certNumber: string,
  lookup: GradeLookupResult,
  cardName: string,
  game: Game,
  setName: string,
  marketPriceUsd: number | null
): ScannedCard {
  return {
    id: uuid(),
    game,
    name: cardName,
    setName: setName || undefined,
    condition: "Near Mint",
    quantity: 1,
    foil: false,
    language: "English",
    photos: [],
    identificationSource: "verified",
    identificationConfidence: 1.0,
    marketPriceUsd: marketPriceUsd ?? undefined,
    createdAt: Date.now(),
    slabbed: true,
    grading: {
      company,
      grade: lookup.grade ?? "",
      certNumber,
      verified: true,
      verifiedAt: Date.now(),
      label: lookup.label,
      population: lookup.population,
      subgrades: lookup.subgrades,
    },
  };
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GradedScanner() {
  const [company, setCompany] = useState<GradingCompany>("psa");
  const [certNumber, setCertNumber] = useState("");

  const [lookingUp, setLookingUp] = useState(false);
  const [lookupResult, setLookupResult] = useState<GradeLookupResult | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricing, setPricing] = useState<GradedPriceResult | null>(null);

  // Editable card fields (pre-filled from lookup, user can adjust)
  const [cardName, setCardName] = useState("");
  const [game, setGame] = useState<Game>("pokemon");
  const [setNameField, setSetNameField] = useState("");
  const [marketPrice, setMarketPrice] = useState<string>("");

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Cert lookup ─────────────────────────────────────────────────────────────

  const handleLookup = async () => {
    if (!certNumber.trim()) return;
    setLookingUp(true);
    setLookupError(null);
    setLookupResult(null);
    setPricing(null);
    setSaved(false);
    setSaveError(null);

    try {
      const res = await fetch("/api/grade-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company, certNumber: certNumber.trim() }),
      });
      const data: GradeLookupResult = await res.json();

      if (!res.ok || !data.verified) {
        setLookupError(data.error ?? "Cert not found — double-check the number and try again.");
        return;
      }

      setLookupResult(data);

      // Pre-fill editable fields from cert data
      if (data.cardName) setCardName(data.cardName);
      if (data.setName) setSetNameField(data.setName);

      // Immediately fetch graded market price if we have a card name + grade
      if (data.grade && data.cardName) {
        fetchGradedPrice(company, data.grade, data.cardName, data.setName);
      }
    } catch {
      setLookupError("Network error — please check your connection.");
    } finally {
      setLookingUp(false);
    }
  };

  const fetchGradedPrice = async (
    co: GradingCompany,
    grade: string,
    name: string,
    set?: string
  ) => {
    setPricingLoading(true);
    try {
      const params = new URLSearchParams({ company: co, grade, name });
      if (set) params.set("set", set);
      const res = await fetch(`/api/graded-price?${params.toString()}`);
      const data: GradedPriceResult = await res.json();
      setPricing(data);
      if (data.found && data.marketPriceUsd) {
        setMarketPrice(data.marketPriceUsd.toFixed(2));
      }
    } catch {
      // Non-fatal — user can enter price manually
    } finally {
      setPricingLoading(false);
    }
  };

  // ── Save to collection ───────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!lookupResult?.verified || !cardName) return;
    setSaving(true);
    setSaveError(null);

    const card = buildScannedCard(
      company,
      certNumber.trim(),
      lookupResult,
      cardName,
      game,
      setNameField,
      marketPrice ? parseFloat(marketPrice) : null
    );

    try {
      const res = await fetch("/api/graded-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ card }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save — please try again.");
        return;
      }
      setSaved(true);
    } catch {
      setSaveError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Export eBay CSV ──────────────────────────────────────────────────────────

  const handleExport = async () => {
    if (!lookupResult?.verified || !cardName) return;

    const card = buildScannedCard(
      company,
      certNumber.trim(),
      lookupResult,
      cardName,
      game,
      setNameField,
      marketPrice ? parseFloat(marketPrice) : null
    );

    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards: [card], format: "ebay" }),
      });
      if (!res.ok) return;

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `graded-${company}-${certNumber.trim()}-ebay.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // Non-fatal — user can retry
    }
  };

  // ── Reset ────────────────────────────────────────────────────────────────────

  const reset = () => {
    setCertNumber("");
    setLookupResult(null);
    setLookupError(null);
    setPricing(null);
    setCardName("");
    setSetNameField("");
    setMarketPrice("");
    setSaved(false);
    setSaveError(null);
  };

  // ── Render ───────────────────────────────────────────────────────────────────

  const companyLabel = GRADING_COMPANY_LABELS[company];

  return (
    <div className="space-y-6 max-w-2xl">
      {/* ── Lookup form ── */}
      <div className="card-panel p-5">
        <div className="flex items-center gap-2 mb-4">
          <Award className="w-5 h-5 text-amber-400" />
          <h2 className="text-base font-semibold">Cert Lookup</h2>
          <span className="text-xs text-muted">
            Enter a PSA, BGS, CGC, or SGC certificate number to auto-fill your graded card
          </span>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Company selector */}
          <select
            className="input w-36 shrink-0"
            value={company}
            onChange={(e) => {
              setCompany(e.target.value as GradingCompany);
              setLookupResult(null);
              setLookupError(null);
              setPricing(null);
              setSaved(false);
            }}
          >
            {GRADING_COMPANIES.map((gc) => (
              <option key={gc.key} value={gc.key}>
                {gc.label}
              </option>
            ))}
          </select>

          {/* Cert number input */}
          <input
            className="input flex-1"
            placeholder={`${companyLabel} certificate number`}
            value={certNumber}
            onChange={(e) => {
              setCertNumber(e.target.value);
              if (lookupResult) {
                setLookupResult(null);
                setLookupError(null);
                setPricing(null);
                setSaved(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLookup();
            }}
          />

          {/* Look up button */}
          <button
            className="btn shrink-0"
            onClick={handleLookup}
            disabled={lookingUp || !certNumber.trim()}
          >
            {lookingUp ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Search className="w-4 h-4" />
            )}
            {lookingUp ? "Looking up…" : "Look Up"}
          </button>
        </div>

        {/* Error */}
        {lookupError && (
          <p className="mt-3 text-sm text-amber-400 flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            {lookupError}
          </p>
        )}
      </div>

      {/* ── Verification result ── */}
      {lookupResult?.verified && (
        <>
          {/* Cert result card */}
          <div className="card-panel p-5 border-amber-500/20">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-400" />
                <span className="text-sm font-semibold text-green-400">
                  {companyLabel} Verified
                </span>
                <span className="text-xs text-muted">· Cert #{certNumber.trim()}</span>
              </div>
              <button
                className="text-xs text-muted hover:text-foreground flex items-center gap-1"
                onClick={reset}
              >
                <RefreshCw className="w-3 h-3" />
                Start over
              </button>
            </div>

            {/* Grade hero */}
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <p className="text-[10px] text-muted uppercase tracking-widest">Grade</p>
                <p
                  className={`text-4xl font-extrabold tabular-nums ${gradeColor(
                    company,
                    lookupResult.grade ?? ""
                  )}`}
                >
                  {lookupResult.grade ?? "—"}
                </p>
                <p className="text-xs text-muted mt-0.5">{companyLabel}</p>
              </div>

              <div className="flex-1 space-y-1.5">
                {lookupResult.cardName && (
                  <div className="flex items-start gap-2 text-sm">
                    <Tag className="w-3.5 h-3.5 text-muted mt-0.5 shrink-0" />
                    <span className="font-medium">{lookupResult.cardName}</span>
                  </div>
                )}
                {lookupResult.setName && (
                  <div className="flex items-center gap-2 text-sm text-muted">
                    <Calendar className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      {lookupResult.setName}
                      {lookupResult.year ? ` (${lookupResult.year})` : ""}
                    </span>
                  </div>
                )}
                {lookupResult.label && (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Award className="w-3.5 h-3.5 shrink-0" />
                    <span>{lookupResult.label} Label</span>
                  </div>
                )}
                {lookupResult.population != null && (
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <Users className="w-3.5 h-3.5 shrink-0" />
                    <span>
                      Pop: {lookupResult.population.toLocaleString()} at this grade
                    </span>
                  </div>
                )}
              </div>

              {/* Graded market price */}
              <div className="text-right shrink-0">
                <p className="text-[10px] text-muted uppercase tracking-widest">Market</p>
                {pricingLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted mx-auto mt-1" />
                ) : pricing?.found && pricing.marketPriceUsd ? (
                  <>
                    <p className="text-xl font-bold text-accent">
                      ${pricing.marketPriceUsd.toLocaleString("en-US", {
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 0,
                      })}
                    </p>
                    <p className="text-[10px] text-muted mt-0.5">
                      {pricing.sampleSize} eBay sales
                    </p>
                  </>
                ) : pricing && !pricing.found ? (
                  <p className="text-xs text-muted mt-1">No eBay data</p>
                ) : null}
              </div>
            </div>

            {/* BGS sub-grades */}
            {company === "bgs" && lookupResult.subgrades && (
              <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border">
                {Object.entries(lookupResult.subgrades).map(([k, v]) => (
                  <div key={k} className="text-center">
                    <p className="text-[10px] text-muted capitalize">{k}</p>
                    <p className="text-sm font-semibold">{v}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── Editable card details ── */}
          <div className="card-panel p-5">
            <h3 className="text-sm font-semibold mb-4">Card Details</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="label">Card Name</label>
                <input
                  className="input mt-1"
                  value={cardName}
                  onChange={(e) => setCardName(e.target.value)}
                  placeholder="e.g. Charizard Holo"
                />
              </div>

              <div>
                <label className="label">Game</label>
                <select
                  className="input mt-1"
                  value={game}
                  onChange={(e) => setGame(e.target.value as Game)}
                >
                  {GAMES.map((g) => (
                    <option key={g} value={g}>
                      {GAME_LABELS[g]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">Set Name</label>
                <input
                  className="input mt-1"
                  value={setNameField}
                  onChange={(e) => setSetNameField(e.target.value)}
                  placeholder="e.g. Base Set"
                />
              </div>

              <div>
                <label className="label">Market Price (USD)</label>
                <div className="relative mt-1">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="number"
                    className="input pl-8"
                    value={marketPrice}
                    onChange={(e) => setMarketPrice(e.target.value)}
                    placeholder="0.00"
                    min="0"
                    step="0.01"
                  />
                </div>
                {pricing?.found && pricing.marketPriceUsd && (
                  <p className="text-[10px] text-muted mt-1">
                    eBay comp: ~${pricing.marketPriceUsd.toLocaleString("en-US", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} ({pricing.sampleSize} sales)
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap gap-3 mt-5 pt-4 border-t border-border">
              {!saved ? (
                <button
                  className="btn-primary flex items-center gap-2"
                  onClick={handleSave}
                  disabled={saving || !cardName}
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  {saving ? "Saving…" : "Add to Collection"}
                </button>
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  Saved to Graded Cards batch!
                  <button
                    className="text-muted hover:text-foreground text-xs underline ml-2"
                    onClick={reset}
                  >
                    Scan another
                  </button>
                </div>
              )}

              <button
                className="btn flex items-center gap-2"
                onClick={handleExport}
                disabled={!cardName}
                title="Export this card as an eBay CSV listing"
              >
                <Download className="w-4 h-4" />
                eBay CSV
              </button>
            </div>

            {saveError && (
              <p className="mt-2 text-sm text-danger">{saveError}</p>
            )}
          </div>
        </>
      )}

      {/* ── How it works hint (empty state) ── */}
      {!lookupResult && !lookingUp && !lookupError && (
        <div className="card-panel p-5 border-dashed">
          <p className="text-sm text-muted leading-relaxed">
            <span className="font-medium text-foreground">How it works:</span>{" "}
            Select your grading company, enter the cert number from the label (usually 8–10 digits),
            and hit <strong>Look Up</strong>. SnapList will verify the grade, auto-fill the card
            name and set, and fetch graded market comps from recent eBay sales.
          </p>
          <div className="grid grid-cols-3 gap-3 mt-4 text-center text-xs text-muted">
            <div className="p-3 rounded-lg bg-panel2">
              <ShieldCheck className="w-5 h-5 text-green-400 mx-auto mb-1" />
              Cert verified
            </div>
            <div className="p-3 rounded-lg bg-panel2">
              <DollarSign className="w-5 h-5 text-accent mx-auto mb-1" />
              eBay comps
            </div>
            <div className="p-3 rounded-lg bg-panel2">
              <Download className="w-5 h-5 text-blue-400 mx-auto mb-1" />
              eBay CSV export
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
