"use client";

import { useState, useMemo } from "react";
import type { ListingTemplate, ScannedCard, ExportPlatform } from "@/lib/types";
import { Download, FileSpreadsheet, FileJson, Package, ShoppingBag, Store, Globe, Loader2, CheckCircle2, Shield, AlertTriangle, XCircle, ExternalLink, X, Info } from "lucide-react";
import type { ExportFormat } from "@/lib/exporters";
import { validateBatch, type BatchValidationResult } from "@/lib/listingValidation";
import ValidationReport from "./ValidationReport";

const IMPORT_INSTRUCTIONS: Partial<Record<ExportFormat, { title: string; steps: string[]; link?: string; linkLabel?: string }>> = {
  tcgplayer: {
    title: "Import to TCGPlayer Seller Portal",
    steps: [
      "Log in to your TCGPlayer Seller Portal account.",
      "Go to Inventory → Bulk Add/Update.",
      "Click \"Upload File\" and select the CSV you just downloaded.",
      "Review the matched products and confirm quantities & prices.",
      "Click \"Submit\" to publish your listings.",
    ],
    link: "https://store.tcgplayer.com/admin/inventory/massentry",
    linkLabel: "Open TCGPlayer Seller Portal",
  },
  whatnot: {
    title: "Import to Whatnot",
    steps: [
      "Log in to your Whatnot Seller Dashboard.",
      "Go to Listings → Bulk Upload.",
      "Click \"Upload CSV\" and select the file you just downloaded.",
      "Map any required fields if prompted, then confirm.",
      "Your items will appear in your active listings.",
    ],
    link: "https://www.whatnot.com/sell",
    linkLabel: "Open Whatnot Seller Dashboard",
  },
};

export interface EbayBulkResult {
  successes: number;
  failures: number;
  // Per-card results so the parent can mark successfully listed cards
  items: { sku: string; listingId?: string; success: boolean }[];
}

interface Props {
  cards: ScannedCard[];
  templates: ListingTemplate[];
  ebayConnected?: boolean;
  onEbayListAll?: (result: EbayBulkResult) => void;
}

const FORMATS: { key: ExportFormat; label: string; Icon: React.ComponentType<{ className?: string }>; platform: ExportPlatform }[] = [
  { key: "ebay", label: "eBay", Icon: Package, platform: "ebay" },
  { key: "tcgplayer", label: "TCGPlayer", Icon: FileSpreadsheet, platform: "tcgplayer" },
  { key: "whatnot", label: "Whatnot", Icon: ShoppingBag, platform: "whatnot" },
  { key: "shopify", label: "Shopify", Icon: Store, platform: "shopify" },
  { key: "squarespace", label: "Squarespace", Icon: Globe, platform: "squarespace" },
  { key: "csv", label: "CSV", Icon: FileSpreadsheet, platform: "generic" },
  { key: "json", label: "JSON", Icon: FileJson, platform: "generic" }
];

export default function ExportBar({ cards, templates, ebayConnected, onEbayListAll }: Props) {
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [ebayBusy, setEbayBusy] = useState(false);
  const [importTip, setImportTip] = useState<ExportFormat | null>(null);

  // Validation state
  const [validationResult, setValidationResult] = useState<BatchValidationResult | null>(null);
  const [validationPlatform, setValidationPlatform] = useState<string>("");
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  // Quick validation counts for the eBay push button badge
  const ebayValidation = useMemo(() => {
    if (!ebayConnected || cards.length === 0) return null;
    const unlistedCards = cards.filter((c) => !c.ebayListingId);
    if (unlistedCards.length === 0) return null;
    const result = validateBatch(unlistedCards, "ebay", templates);
    return { errors: result.totalErrors, warnings: result.totalWarnings };
  }, [cards, templates, ebayConnected]);

  const runValidationThenAct = (platform: ExportPlatform, platformLabel: string, cardsToValidate: ScannedCard[], action: () => void) => {
    const result = validateBatch(cardsToValidate, platform, templates);
    if (result.isValid && result.totalWarnings === 0) {
      // Clean — proceed directly
      action();
    } else {
      // Show validation report
      setValidationResult(result);
      setValidationPlatform(platformLabel);
      setPendingAction(() => action);
    }
  };

  const requestDownload = (format: ExportFormat, platform: ExportPlatform, label: string) => {
    if (cards.length === 0) return;
    runValidationThenAct(platform, label, cards, () => download(format));
  };

  const download = async (format: ExportFormat) => {
    if (cards.length === 0) return;
    setBusy(format);
    setImportTip(null);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cards, format, templates })
      });
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const disp = res.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(disp);
      const filename = match?.[1] || `tcg-export.${format === "json" ? "json" : "csv"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      // Show import instructions for platforms that require a manual CSV import step
      if (IMPORT_INSTRUCTIONS[format]) setImportTip(format);
    } catch (err) {
      console.error(err);
      alert("Export failed — see console for details.");
    } finally {
      setBusy(null);
    }
  };

  const requestEbayList = () => {
    const unlistedCards = cards.filter((c) => !c.ebayListingId);
    if (unlistedCards.length === 0) return;
    runValidationThenAct("ebay", "eBay Direct Listing", unlistedCards, () => listAllOnEbay());
  };

  const listAllOnEbay = async () => {
    const unlistedCards = cards.filter((c) => !c.ebayListingId);
    if (unlistedCards.length === 0) return;
    setEbayBusy(true);
    try {
      const res = await fetch("/api/ebay/list", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards: unlistedCards,
          config: { bestOfferEnabled: true, listingDuration: "GTC" },
        }),
      });
      const data = await res.json();
      if (res.ok && data.summary) {
        onEbayListAll?.({
          successes: data.summary.successes,
          failures: data.summary.failures,
          items: (data.results ?? []).map((r: { sku?: string; listingId?: string; success: boolean }) => ({
            sku: r.sku ?? "",
            listingId: r.listingId,
            success: r.success,
          })),
        });
      } else {
        alert(data.error || "eBay listing failed");
      }
    } catch {
      alert("Network error — eBay listing failed");
    } finally {
      setEbayBusy(false);
    }
  };

  const closeValidation = () => {
    setValidationResult(null);
    setPendingAction(null);
  };

  const proceedAfterValidation = () => {
    const action = pendingAction;
    closeValidation();
    action?.();
  };

  const disabled = cards.length === 0;
  const unlistedCount = cards.filter((c) => !c.ebayListingId).length;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {/* eBay direct listing button with validation badge */}
        {ebayConnected && unlistedCount > 0 && (
          <button
            className="btn-primary text-xs relative"
            disabled={ebayBusy || disabled}
            onClick={requestEbayList}
            title={`List ${unlistedCount} card${unlistedCount !== 1 ? "s" : ""} on eBay`}
          >
            {ebayBusy ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <ShoppingBag className="w-4 h-4" />
            )}
            {ebayBusy ? "Listing…" : `List on eBay (${unlistedCount})`}
            {ebayValidation && ebayValidation.errors > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-danger text-[10px] font-bold flex items-center justify-center text-white">
                {ebayValidation.errors > 9 ? "!" : ebayValidation.errors}
              </span>
            )}
            {ebayValidation && ebayValidation.errors === 0 && ebayValidation.warnings > 0 && (
              <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-amber-400 text-[10px] font-bold flex items-center justify-center text-black">
                {ebayValidation.warnings > 9 ? "!" : ebayValidation.warnings}
              </span>
            )}
          </button>
        )}
        {ebayConnected && unlistedCount === 0 && cards.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs text-accent2">
            <CheckCircle2 className="w-4 h-4" />
            All listed on eBay
          </span>
        )}
        {FORMATS.map(({ key, label, Icon, platform }) => (
          <button
            key={key}
            className="btn"
            disabled={disabled || busy !== null}
            onClick={() => requestDownload(key, platform, label)}
            title={`Download ${label}`}
          >
            {busy === key ? (
              <span className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
            ) : (
              <Icon className="w-4 h-4" />
            )}
            {label}
          </button>
        ))}
        {!disabled && (
          <span className="text-xs text-muted inline-flex items-center gap-1 ml-2">
            <Download className="w-3 h-3" /> {cards.length} row{cards.length === 1 ? "" : "s"}
          </span>
        )}
      </div>

      {/* Validation report modal */}
      {validationResult && (
        <ValidationReport
          result={validationResult}
          platform={validationPlatform}
          onClose={closeValidation}
          onProceed={validationResult.isValid ? proceedAfterValidation : undefined}
        />
      )}

      {/* Post-download import instructions panel */}
      {importTip && IMPORT_INSTRUCTIONS[importTip] && (() => {
        const tip = IMPORT_INSTRUCTIONS[importTip]!;
        return (
          <div className="mt-3 rounded-xl border border-accent/20 bg-accent/[0.04] p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                <span className="text-sm font-semibold">{tip.title}</span>
              </div>
              <button onClick={() => setImportTip(null)} className="text-muted hover:text-foreground transition-colors shrink-0">
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-1.5 mb-3 ml-6 list-decimal">
              {tip.steps.map((step, i) => (
                <li key={i} className="text-xs text-muted">{step}</li>
              ))}
            </ol>
            {tip.link && (
              <a
                href={tip.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {tip.linkLabel}
              </a>
            )}
          </div>
        );
      })()}
    </>
  );
}
