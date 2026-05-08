"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import type { CardPhoto, Condition, Game, GradingCompany, GradingInfo, PhotoRole, ScannedCard } from "@/lib/types";
import { CONDITIONS, CONDITION_MULTIPLIERS, GAME_LABELS, GRADING_COMPANIES, GRADING_COMPANY_LABELS } from "@/lib/types";
import { evaluateCard, DEFAULT_DECISION_RULES, type DecisionRules } from "@/lib/decisionEngine";
import { computeListPrice, DEFAULT_PRICING_CONFIG, type PricingConfig, type PricingResult } from "@/lib/pricingEngine";
import { PLATFORM_FEES } from "@/lib/platformFees";
import { DecisionChip, DecisionCard as DecisionCardView } from "./DecisionBadge";
import {
  Search,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Eye,
  Type,
  Brain,
  Plus,
  X,
  ImageIcon,
  Shield,
  ShieldCheck,
  Loader2,
  Award,
  ShoppingBag,
  CheckCircle2,
  DollarSign,
  TrendingDown,
  Info,
  Tag,
  Hash,
} from "lucide-react";

interface Props {
  card: ScannedCard;
  onChange: (patch: Partial<ScannedCard>) => void;
  onRemove: () => void;
  onRelookup: () => void;
  onVerify?: () => void;
  ebayConnected?: boolean;
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Abbreviated condition labels for the price table
const CONDITION_SHORT: Record<Condition, string> = {
  "Near Mint":         "NM",
  "Lightly Played":    "LP",
  "Moderately Played": "MP",
  "Heavily Played":    "HP",
  "Damaged":           "DMG",
};

export default function CardRow({ card, onChange, onRemove, onRelookup, onVerify, ebayConnected }: Props) {
  const [expanded, setExpanded] = useState(!card.name);
  const [lookingUp, setLookingUp] = useState(false);
  const [verifyingGrade, setVerifyingGrade] = useState(false);
  const [gradeError, setGradeError] = useState<string | null>(null);
  const [ebayListing, setEbayListing] = useState(false);
  const [ebayError, setEbayError] = useState<string | null>(null);
  const addPhotoRef = useRef<HTMLInputElement>(null);
  const [addPhotoRole, setAddPhotoRole] = useState<PhotoRole>("back");

  const photos = card.photos || [];
  const frontPhoto = photos.find((p) => p.role === "front");
  const backPhoto = photos.find((p) => p.role === "back");
  const extraPhotos = photos.filter((p) => p.role === "extra");

  const doRelookup = async () => {
    setLookingUp(true);
    try {
      await onRelookup();
    } finally {
      setLookingUp(false);
    }
  };

  const listOnEbay = async () => {
    if (ebayListing || card.ebayListingId) return;
    setEbayListing(true);
    setEbayError(null);
    try {
      const listPrice = pricing.listPrice > 0 ? pricing.listPrice : (card.marketPriceUsd ?? 0.99);
      const res = await fetch("/api/ebay/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: [{ ...card, listPrice }],
          config: { listPrice, bestOfferEnabled: true, listingDuration: "GTC" },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setEbayError(data.error || "Listing failed");
        return;
      }
      const result = data.results?.[0];
      if (result?.success) {
        onChange({
          ebayListingId: result.listingId,
          ebayOfferId: result.offerId,
          sku: result.sku || card.sku,
        });
      } else {
        setEbayError(result?.error || "Listing failed");
      }
    } catch {
      setEbayError("Network error — try again");
    } finally {
      setEbayListing(false);
    }
  };

  const verifyCert = async () => {
    if (!card.grading?.company || !card.grading?.certNumber) return;
    setVerifyingGrade(true);
    setGradeError(null);
    try {
      const res = await fetch("/api/grade-lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: card.grading.company,
          certNumber: card.grading.certNumber,
        }),
      });
      const data = await res.json();
      if (data.verified) {
        const patch: Partial<ScannedCard> = {
          grading: {
            ...card.grading,
            grade: data.grade || card.grading.grade,
            verified: true,
            verifiedAt: Date.now(),
            subgrades: data.subgrades || card.grading.subgrades,
            population: data.population || card.grading.population,
            label: data.label || card.grading.label,
          },
        };
        if (data.cardName && !card.name) patch.name = data.cardName;
        if (data.setName && !card.setName) patch.setName = data.setName;
        onChange(patch);
      } else {
        setGradeError(data.error || "Verification failed");
      }
    } catch {
      setGradeError("Network error during verification");
    } finally {
      setVerifyingGrade(false);
    }
  };

  const addPhotos = useCallback(
    async (files: FileList | null, role: PhotoRole) => {
      if (!files || files.length === 0) return;
      const newPhotos: CardPhoto[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await fileToDataUrl(file);
        newPhotos.push({ id: uuid(), role, dataUrl });
      }
      let updated = [...photos];
      if (role === "back") {
        updated = updated.filter((p) => p.role !== "back");
      }
      onChange({ photos: [...updated, ...newPhotos] });
    },
    [photos, onChange]
  );

  const removePhoto = useCallback(
    (photoId: string) => {
      onChange({ photos: photos.filter((p) => p.id !== photoId) });
    },
    [photos, onChange]
  );

  const triggerAddPhoto = (role: PhotoRole) => {
    setAddPhotoRole(role);
    setTimeout(() => addPhotoRef.current?.click(), 0);
  };

  const userRules = useMemo<DecisionRules>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("decision_rules") : null;
      return saved ? { ...DEFAULT_DECISION_RULES, ...JSON.parse(saved) } : DEFAULT_DECISION_RULES;
    } catch { return DEFAULT_DECISION_RULES; }
  }, []);

  const userPricing = useMemo<PricingConfig>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("pricing_config") : null;
      return saved ? { ...DEFAULT_PRICING_CONFIG, ...JSON.parse(saved) } : DEFAULT_PRICING_CONFIG;
    } catch { return DEFAULT_PRICING_CONFIG; }
  }, []);

  const decision = useMemo(() => evaluateCard(card, userRules), [card, userRules]);
  const pricing = useMemo(() => computeListPrice(card, userPricing), [card, userPricing]);

  const displayImage = card.imageUrl || frontPhoto?.dataUrl || card.uploadedImageDataUrl;

  // Build condition price rows from variants or single marketPriceUsd
  const priceColumns = useMemo(() => {
    if (card.variants && card.variants.length > 0) {
      return card.variants
        .filter((v) => v.marketPrice != null && v.marketPrice > 0)
        .slice(0, 3); // max 3 columns
    }
    if (card.marketPriceUsd && card.marketPriceUsd > 0) {
      return [{ finish: "non-holo" as const, label: "Market", marketPrice: card.marketPriceUsd }];
    }
    return [];
  }, [card.variants, card.marketPriceUsd]);

  const hasConditionTable = priceColumns.length > 0;

  return (
    <div className="card-panel overflow-hidden">
      {/* ── Header: name + chips + actions ── */}
      <div className="flex gap-3">
        {/* Photo strip */}
        <div className="shrink-0 flex flex-col gap-1.5">
          {/* Front image */}
          <div className="relative w-24">
            <div
              className="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-panel2 border border-border cursor-pointer group"
              onClick={onVerify}
              title="Click to verify / change match"
            >
              {displayImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={displayImage} alt={card.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-muted text-[10px] text-center px-1">
                  No image
                </div>
              )}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-[10px] text-white font-medium bg-accent/80 px-2 py-1 rounded">
                  Verify
                </span>
              </div>
            </div>
            <SourceBadge source={card.identificationSource} confidence={card.identificationConfidence} />
            <div className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/60 text-[9px] text-white/80">Front</div>
          </div>

          {/* Back photo */}
          <div className="relative w-24">
            {backPhoto ? (
              <div className="relative">
                <div className="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-panel2 border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={backPhoto.dataUrl} alt="Back" className="w-full h-full object-cover" />
                </div>
                <button
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center"
                  onClick={() => removePhoto(backPhoto.id)}
                >
                  <X className="w-3 h-3" />
                </button>
                <div className="absolute bottom-1 left-1 px-1 py-0.5 rounded bg-black/60 text-[9px] text-white/80">Back</div>
              </div>
            ) : (
              <button
                className="w-full aspect-[2.5/3.5] rounded-lg border-2 border-dashed border-border hover:border-accent/50 bg-panel2 flex flex-col items-center justify-center gap-1 text-muted hover:text-accent transition-colors"
                onClick={() => triggerAddPhoto("back")}
              >
                <Plus className="w-4 h-4" />
                <span className="text-[9px]">Add back</span>
              </button>
            )}
          </div>

          {/* Extra photos */}
          {extraPhotos.map((photo) => (
            <div key={photo.id} className="relative w-24">
              <div className="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-panel2 border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo.dataUrl} alt="Extra" className="w-full h-full object-cover" />
              </div>
              <button
                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-danger text-white flex items-center justify-center"
                onClick={() => removePhoto(photo.id)}
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}

          {/* Add photo */}
          <button
            className="w-24 py-1.5 rounded-lg border border-dashed border-border hover:border-accent/50 bg-panel2 flex items-center justify-center gap-1 text-muted hover:text-accent transition-colors text-[10px]"
            onClick={() => triggerAddPhoto("extra")}
          >
            <ImageIcon className="w-3 h-3" />
            Add photo
          </button>

          <input
            ref={addPhotoRef}
            type="file"
            accept="image/*"
            multiple={addPhotoRole === "extra"}
            className="hidden"
            onChange={(e) => {
              addPhotos(e.target.files, addPhotoRole);
              e.target.value = "";
            }}
          />
        </div>

        {/* Main body */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {/* Name row */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <input
                  className="bg-transparent border-0 text-base font-semibold outline-none focus:ring-0 p-0 w-full max-w-md placeholder:text-muted/50"
                  value={card.name}
                  placeholder="Card name"
                  onChange={(e) => onChange({ name: e.target.value })}
                />
                {card.externalUrl && (
                  <a href={card.externalUrl} target="_blank" rel="noreferrer" className="text-muted hover:text-accent shrink-0">
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              {/* Chips */}
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <span className="chip text-[10px]">{GAME_LABELS[card.game]}</span>
                {card.setName && (
                  <span className="chip text-[10px]">
                    {card.setName}{card.setCode ? ` · ${card.setCode}` : ""}
                  </span>
                )}
                {card.collectorNumber && (
                  <span className="chip text-[10px] flex items-center gap-0.5">
                    <Hash className="w-2.5 h-2.5" />{card.collectorNumber}
                  </span>
                )}
                {card.rarity && <span className="chip text-[10px]">{card.rarity}</span>}
                {card.foil && <span className="chip text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-400">Foil</span>}
                {card.slabbed && card.grading && (
                  <span className="chip text-[10px] bg-amber-500/10 border-amber-500/30 text-amber-400 flex items-center gap-0.5">
                    <Award className="w-2.5 h-2.5" />
                    {GRADING_COMPANY_LABELS[card.grading.company]} {card.grading.grade}
                    {card.grading.verified && <ShieldCheck className="w-2.5 h-2.5 text-green-400" />}
                  </span>
                )}
                <DecisionChip decision={decision} />
                <span className="chip text-[10px] flex items-center gap-0.5">
                  <ImageIcon className="w-2.5 h-2.5" />{photos.length} photo{photos.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 shrink-0">
              {ebayConnected && !card.ebayListingId && (
                <button
                  className="btn text-xs"
                  onClick={listOnEbay}
                  disabled={ebayListing || !card.name}
                  title="List this card on eBay"
                >
                  {ebayListing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                  {ebayListing ? "Listing…" : "eBay"}
                </button>
              )}
              {card.ebayListingId && (
                <a
                  href={`https://www.ebay.com/itm/${card.ebayListingId}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn text-xs text-accent2"
                  title="View on eBay"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Listed
                </a>
              )}
              <button
                className="btn text-xs"
                onClick={doRelookup}
                disabled={lookingUp || !card.name}
                title="Re-lookup this card"
              >
                <Search className="w-3.5 h-3.5" />
                {lookingUp ? "Looking…" : "Lookup"}
              </button>
              <button className="btn-danger" onClick={onRemove} title="Remove">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {ebayError && <p className="text-xs text-danger -mt-1">{ebayError}</p>}

          {/* ── Body: condition price table + listing controls ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

            {/* LEFT: Condition price table */}
            {hasConditionTable ? (
              <div className="bg-panel2 border border-border rounded-xl overflow-hidden">
                <div className="px-3 py-2 border-b border-border flex items-center gap-1.5">
                  <DollarSign className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Market Prices</span>
                  <span className="text-[9px] text-muted/60 ml-auto">NM = market rate</span>
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-3 py-1.5 text-[10px] text-muted font-medium">Condition</th>
                      {priceColumns.map((col) => (
                        <th key={col.finish} className="text-right px-3 py-1.5 text-[10px] text-muted font-medium">
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {CONDITIONS.map((cond) => {
                      const mult = CONDITION_MULTIPLIERS[cond] ?? 1;
                      const isSelected = card.condition === cond;
                      return (
                        <tr
                          key={cond}
                          className={`cursor-pointer transition-colors ${
                            isSelected
                              ? "bg-accent/10 border-l-2 border-l-accent"
                              : "hover:bg-white/5"
                          }`}
                          onClick={() => onChange({ condition: cond })}
                          title={`Set condition to ${cond}`}
                        >
                          <td className={`px-3 py-1.5 font-medium ${isSelected ? "text-accent" : "text-muted"}`}>
                            <span className="font-bold mr-1">{CONDITION_SHORT[cond]}</span>
                            <span className="text-[10px] font-normal opacity-70">{cond !== "Near Mint" ? `(${Math.round(mult * 100)}%)` : ""}</span>
                          </td>
                          {priceColumns.map((col) => {
                            const price = col.marketPrice != null ? col.marketPrice * mult : null;
                            return (
                              <td key={col.finish} className={`px-3 py-1.5 text-right tabular-nums ${isSelected ? "text-accent font-semibold" : "text-white/80"}`}>
                                {price != null ? `$${price.toFixed(2)}` : "—"}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                <div className="px-3 py-1.5 border-t border-border">
                  <p className="text-[9px] text-muted/60">Estimates based on NM market price. Click a row to set condition.</p>
                </div>
              </div>
            ) : (
              /* No price data — show simple market price input */
              <div className="bg-panel2 border border-border rounded-xl p-3 flex flex-col gap-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <DollarSign className="w-3.5 h-3.5 text-accent" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Pricing</span>
                </div>
                <NumField
                  label="Market Price (NM)"
                  value={card.marketPriceUsd ?? 0}
                  step={0.25}
                  onChange={(v) => onChange({ marketPriceUsd: v })}
                />
                {pricing.listPrice > 0 && pricing.marketPrice > 0 && (
                  <div>
                    <label className="label">List Price</label>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-sm font-semibold text-accent">${pricing.listPrice.toFixed(2)}</span>
                      {pricing.adjustment !== 0 && (
                        <span className={`text-[10px] font-medium ${pricing.adjustment > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                          {pricing.adjustment > 0 ? "+" : ""}{pricing.adjustmentPercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {pricing.listPrice > 0 && pricing.fees && (
                  <ProfitCell pricing={pricing} />
                )}
              </div>
            )}

            {/* RIGHT: Listing controls */}
            <div className="flex flex-col gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                {/* Market price input (when table is shown, keep it editable) */}
                {hasConditionTable && (
                  <NumField
                    label="NM Market Price"
                    value={card.marketPriceUsd ?? 0}
                    step={0.25}
                    onChange={(v) => onChange({ marketPriceUsd: v })}
                  />
                )}

                <NumField
                  label="Quantity"
                  value={card.quantity}
                  min={1}
                  step={1}
                  onChange={(v) => onChange({ quantity: Math.max(1, Math.round(v)) })}
                />
                <SelectField
                  label="Condition"
                  value={card.condition}
                  options={CONDITIONS}
                  onChange={(v) => onChange({ condition: v as Condition })}
                />
                <SelectField
                  label="Game"
                  value={card.game}
                  options={Object.keys(GAME_LABELS) as Game[]}
                  displayValue={(g) => GAME_LABELS[g as Game]}
                  onChange={(v) => onChange({ game: v as Game })}
                />
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input
                      type="checkbox"
                      checked={card.foil}
                      onChange={(e) => onChange({ foil: e.target.checked })}
                      className="rounded border-border bg-panel2 text-accent focus:ring-accent/40"
                    />
                    Foil
                  </label>
                </div>
              </div>

              {/* List price + profit (when table shown) */}
              {hasConditionTable && pricing.listPrice > 0 && pricing.marketPrice > 0 && (
                <div className="flex items-center gap-3 px-3 py-2 bg-panel2 border border-border rounded-xl">
                  <div className="flex-1">
                    <p className="text-[10px] text-muted uppercase tracking-wider">List Price</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-sm font-bold text-accent">${pricing.listPrice.toFixed(2)}</span>
                      {pricing.adjustment !== 0 && (
                        <span className={`text-[10px] font-medium ${pricing.adjustment > 0 ? "text-emerald-400" : "text-amber-400"}`}>
                          {pricing.adjustment > 0 ? "+" : ""}{pricing.adjustmentPercent.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                  {pricing.fees && (
                    <div className="flex-1 border-l border-border pl-3">
                      <p className="text-[10px] text-muted uppercase tracking-wider">Net Profit</p>
                      <ProfitInline pricing={pricing} />
                    </div>
                  )}
                </div>
              )}

              {/* SKU — visible by default */}
              <div>
                <label className="label flex items-center gap-1">
                  <Tag className="w-3 h-3" /> SKU
                </label>
                <input
                  className="input mt-1 text-sm"
                  value={card.sku || ""}
                  onChange={(e) => onChange({ sku: e.target.value || undefined })}
                  placeholder="e.g. BINDER-A3, BOX-01-042"
                />
              </div>
            </div>
          </div>

          {/* ── More details toggle ── */}
          <button
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-white self-start"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {expanded ? "hide details" : "more details"}
          </button>

          {expanded && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 border-t border-border pt-3">
              <TextField label="Set name" value={card.setName || ""} onChange={(v) => onChange({ setName: v })} />
              <TextField label="Set code" value={card.setCode || ""} onChange={(v) => onChange({ setCode: v.toUpperCase() })} />
              <TextField label="Collector #" value={card.collectorNumber || ""} onChange={(v) => onChange({ collectorNumber: v })} />
              <TextField label="Rarity" value={card.rarity || ""} onChange={(v) => onChange({ rarity: v })} />
              <TextField label="Language" value={card.language} onChange={(v) => onChange({ language: v })} />

              <div className="col-span-full">
                <label className="label">Listing title (leave blank to auto-generate)</label>
                <input
                  className="input mt-1"
                  value={card.listingTitle || ""}
                  onChange={(e) => onChange({ listingTitle: e.target.value || undefined })}
                  placeholder="Auto-generated from template"
                />
              </div>

              <div className="col-span-full">
                <label className="label">Notes</label>
                <textarea
                  className="input mt-1 min-h-[60px]"
                  value={card.notes || ""}
                  onChange={(e) => onChange({ notes: e.target.value })}
                  placeholder="e.g. edge whitening, signed, error print…"
                />
              </div>

              {/* AI Recommendation */}
              <div className="col-span-full border-t border-border pt-3 mt-1">
                <label className="label mb-2 block">AI Recommendation</label>
                <DecisionCardView decision={decision} />
              </div>

              {/* Grading section */}
              <div className="col-span-full border-t border-border pt-3 mt-1">
                <div className="flex items-center gap-3 mb-3">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={!!card.slabbed}
                      onChange={(e) => {
                        const slabbed = e.target.checked;
                        onChange({
                          slabbed,
                          grading: slabbed
                            ? card.grading || { company: "psa" as GradingCompany, grade: "" }
                            : undefined,
                        });
                      }}
                      className="rounded border-border bg-panel2 text-accent focus:ring-accent/40"
                    />
                    <Shield className="w-4 h-4 text-amber-400" />
                    Professionally Graded (Slabbed)
                  </label>
                  {card.grading?.verified && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-400">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Verified
                    </span>
                  )}
                </div>

                {card.slabbed && card.grading && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <label className="label">Grading Company</label>
                      <select
                        className="input mt-1"
                        value={card.grading.company}
                        onChange={(e) =>
                          onChange({ grading: { ...card.grading!, company: e.target.value as GradingCompany } })
                        }
                      >
                        {GRADING_COMPANIES.map((gc) => (
                          <option key={gc.key} value={gc.key}>{gc.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="label">Grade</label>
                      <input
                        className="input mt-1"
                        value={card.grading.grade || ""}
                        onChange={(e) =>
                          onChange({ grading: { ...card.grading!, grade: e.target.value } })
                        }
                        placeholder="e.g. 10, 9.5"
                      />
                    </div>
                    <div>
                      <label className="label">Cert / Serial #</label>
                      <div className="flex gap-2 mt-1">
                        <input
                          className="input flex-1"
                          value={card.grading.certNumber || ""}
                          onChange={(e) =>
                            onChange({ grading: { ...card.grading!, certNumber: e.target.value, verified: false } })
                          }
                          placeholder="Certificate number"
                        />
                        <button
                          className="btn shrink-0"
                          disabled={verifyingGrade || !card.grading.certNumber}
                          onClick={verifyCert}
                        >
                          {verifyingGrade ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                          Verify
                        </button>
                      </div>
                      {gradeError && <p className="text-xs text-amber-400 mt-1">{gradeError}</p>}
                    </div>
                    <div>
                      <label className="label">Label Type</label>
                      <input
                        className="input mt-1"
                        value={card.grading.label || ""}
                        onChange={(e) =>
                          onChange({ grading: { ...card.grading!, label: e.target.value || undefined } })
                        }
                        placeholder="Standard, Gold, Black"
                      />
                    </div>

                    {card.grading.company === "bgs" && (
                      <>
                        {(["centering", "corners", "edges", "surface"] as const).map((sub) => (
                          <div key={sub}>
                            <label className="label capitalize">{sub}</label>
                            <input
                              className="input mt-1"
                              value={card.grading?.subgrades?.[sub] || ""}
                              onChange={(e) =>
                                onChange({
                                  grading: {
                                    ...card.grading!,
                                    subgrades: { ...card.grading!.subgrades, [sub]: e.target.value },
                                  },
                                })
                              }
                              placeholder="0-10"
                            />
                          </div>
                        ))}
                      </>
                    )}

                    {card.grading.population != null && (
                      <div>
                        <label className="label">Population</label>
                        <p className="text-sm mt-1 text-muted">{card.grading.population.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Profit display (inline, for the card body) ──
function ProfitInline({ pricing }: { pricing: PricingResult }) {
  const { netProfit, marginPercent, profitWarning } = pricing;
  const color =
    profitWarning === "loss" ? "text-red-400" : profitWarning === "thin" ? "text-amber-400" : "text-emerald-400";
  return (
    <div className="flex items-center gap-1.5 mt-0.5">
      <span className={`text-sm font-bold ${color}`}>
        {netProfit < 0 ? "-" : ""}${Math.abs(netProfit).toFixed(2)}
      </span>
      <span className={`text-[10px] font-medium ${color}`}>({marginPercent.toFixed(0)}%)</span>
    </div>
  );
}

// ── Profit cell with fee breakdown tooltip (used in no-table mode) ──
function ProfitCell({ pricing }: { pricing: PricingResult }) {
  const [showTooltip, setShowTooltip] = useState(false);
  const { fees, netProfit, marginPercent, profitWarning } = pricing;

  const color =
    profitWarning === "loss" ? "text-red-400" : profitWarning === "thin" ? "text-amber-400" : "text-emerald-400";
  const bgColor =
    profitWarning === "loss" ? "bg-red-500/10 border-red-500/30" : profitWarning === "thin" ? "bg-amber-500/10 border-amber-500/30" : "bg-emerald-500/10 border-emerald-500/30";

  const platformLabel = PLATFORM_FEES[fees.platform]?.label || fees.platform;

  return (
    <div className="relative">
      <label className="label">Net Profit</label>
      <div
        className="flex items-center gap-1.5 mt-1 cursor-help"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
      >
        <span className={`text-sm font-semibold ${color}`}>
          {netProfit < 0 ? "-" : ""}${Math.abs(netProfit).toFixed(2)}
        </span>
        <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[10px] font-medium ${bgColor} ${color}`}>
          {profitWarning === "loss" ? <TrendingDown className="w-3 h-3" /> : <DollarSign className="w-3 h-3" />}
          {marginPercent.toFixed(0)}%
        </span>
        <Info className="w-3 h-3 text-muted" />
      </div>

      {showTooltip && (
        <div className="absolute z-50 top-full left-0 mt-1 w-56 p-3 rounded-lg bg-panel border border-border shadow-xl text-xs">
          <p className="font-medium text-white mb-2">{platformLabel} Fee Breakdown</p>
          <div className="space-y-1 text-muted">
            <FeeRow label="Sale price" value={`$${fees.salePrice.toFixed(2)}`} />
            {fees.fvfFee > 0 && <FeeRow label="Commission" value={`-$${fees.fvfFee.toFixed(2)}`} negative />}
            {(fees.paymentPercentFee + fees.paymentFixedFee) > 0 && (
              <FeeRow label="Payment processing" value={`-$${(fees.paymentPercentFee + fees.paymentFixedFee).toFixed(2)}`} negative />
            )}
            {fees.additionalFee > 0 && <FeeRow label="Platform fee" value={`-$${fees.additionalFee.toFixed(2)}`} negative />}
            {fees.promotedFee > 0 && <FeeRow label="Promoted listing" value={`-$${fees.promotedFee.toFixed(2)}`} negative />}
            {fees.shippingCost > 0 && <FeeRow label="Shipping" value={`-$${fees.shippingCost.toFixed(2)}`} negative />}
            {fees.cogs > 0 && <FeeRow label="Card cost" value={`-$${fees.cogs.toFixed(2)}`} negative />}
            <div className="border-t border-border pt-1 mt-1">
              <FeeRow label="Net profit" value={`${netProfit < 0 ? "-" : ""}$${Math.abs(netProfit).toFixed(2)}`} bold negative={netProfit < 0} />
            </div>
            <p className="text-[10px] text-muted/60 mt-1">Effective fee rate: {fees.effectiveFeeRate.toFixed(1)}%</p>
          </div>
        </div>
      )}
    </div>
  );
}

function FeeRow({ label, value, negative, bold }: { label: string; value: string; negative?: boolean; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold text-white" : ""}`}>
      <span>{label}</span>
      <span className={negative ? "text-red-400" : bold ? "text-white" : ""}>{value}</span>
    </div>
  );
}

// ── Source badge (Vision %, Manual, etc.) ──
function SourceBadge({ source, confidence }: { source: ScannedCard["identificationSource"]; confidence?: number }) {
  const cls =
    source === "vision" ? "bg-accent/15 border-accent/40 text-accent"
    : source === "manual" ? "bg-accent2/15 border-accent2/40 text-accent2"
    : "bg-panel2 border-border text-muted";
  const label =
    source === "vision" ? `Vision${confidence != null ? ` ${(confidence * 100).toFixed(0)}%` : ""}`
    : source === "manual" ? "Manual"
    : "Mock";
  const Icon = source === "vision" ? Eye : source === "manual" ? Type : Brain;
  return (
    <div className={`absolute -top-2 -right-2 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full border text-[9px] font-medium ${cls}`}>
      <Icon className="w-2.5 h-2.5" />
      {label}
    </div>
  );
}

function NumField({ label, value, onChange, step = 1, min }: {
  label: string; value: number; onChange: (v: number) => void; step?: number; min?: number;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <input
        type="number"
        className="input mt-1"
        value={Number.isFinite(value) ? value : 0}
        min={min}
        step={step}
        onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
      />
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input className="input mt-1" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function SelectField<T extends string>({ label, value, options, onChange, displayValue }: {
  label: string; value: T; options: T[]; onChange: (v: T) => void; displayValue?: (v: T) => string;
}) {
  return (
    <div>
      <label className="label">{label}</label>
      <select className="input mt-1" value={value} onChange={(e) => onChange(e.target.value as T)}>
        {options.map((o) => (
          <option key={o} value={o}>{displayValue ? displayValue(o) : o}</option>
        ))}
      </select>
    </div>
  );
}
