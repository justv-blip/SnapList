"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuid } from "uuid";
import { Upload, Camera, Save, Check, AlertTriangle, Copy, Scan, Layers, Loader2 } from "lucide-react";
import type {
  BatchConfig,
  CardPhoto,
  Condition,
  Game,
  ScannedCard,
  ScanResult,
  VisionGuess
} from "@/lib/types";
import { GAME_LABELS } from "@/lib/types";
import type { ListingTemplate, ScanProfile } from "@/lib/types";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import { resizeImageFile } from "@/lib/resizeImage";
import { saveBatch, getBatch, type Batch, type BatchStatus } from "@/lib/supabaseStore";
import { getActiveProfile } from "@/lib/supabaseProfileStore";
import BatchSetup from "./BatchSetup";
import UploadDropzone from "./UploadDropzone";
import CameraScanner, { type CameraMode } from "./CameraScanner";
import CardList from "./CardList";
import ExportBar, { type EbayBulkResult } from "./ExportBar";
import ListingEditor from "./ListingEditor";
import { DuplicateReview } from "./DuplicateReview";
import { detectDuplicates } from "@/lib/duplicates";
import CardVerification from "./CardVerification";
import { computeBatchPricing, pricingBatchStats, DEFAULT_PRICING_CONFIG, type PricingConfig } from "@/lib/pricingEngine";
import { PLATFORM_FEES } from "@/lib/platformFees";
import { logger } from "@/lib/logger";

type InputMode = "upload" | "camera";
type ScannerPhase = "setup" | "scanning";

// How many consecutive capture batches we buffer while one is processing
const MAX_QUEUE_DEPTH = 20;

// Read an image File as a data URL for thumbnail rendering.
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export interface ScannerProps {
  batchId?: string;   // If set, reopens an existing batch for review
}

export default function Scanner({ batchId }: ScannerProps = {}) {
  // Phase: show setup form for new batches, skip straight to scanning for existing ones
  const [phase, setPhase] = useState<ScannerPhase>(batchId ? "scanning" : "setup");
  const [batchConfig, setBatchConfig] = useState<BatchConfig | null>(null);

  const [cards, setCards] = useState<ScannedCard[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanCount, setScanCount] = useState(0); // number of images being processed
  const [visionEnabled, setVisionEnabled] = useState<boolean | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [defaultGame, setDefaultGame] = useState<Game>("pokemon");
  const [inputMode, setInputMode] = useState<InputMode>("upload");
  const [cameraMode, setCameraMode] = useState<CameraMode>("listing");
  // Queue for listing-mode camera: captures fire immediately, process sequentially
  const captureQueueRef = useRef<File[][]>([]);
  const queueProcessingRef = useRef(false);
  const [queueCount, setQueueCount] = useState(0);
  const [templates, setTemplates] = useState<ListingTemplate[]>([...DEFAULT_TEMPLATES]);
  const [currentBatchId, setCurrentBatchId] = useState<string>(batchId || "");
  const [batchName, setBatchName] = useState("");
  const [saved, setSaved] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const [activeProfile, setActiveProfile] = useState<ScanProfile | null>(null);
  const [ebayConnected, setEbayConnected] = useState(false);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [verifyIndex, setVerifyIndex] = useState<number | null>(null);
  const duplicateCount = useMemo(() => detectDuplicates(cards).length, [cards]);

  // Check eBay connection status
  useEffect(() => {
    fetch("/api/ebay/status")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.connected) setEbayConnected(true); })
      .catch(() => {});
  }, []);

  // Load active scan profile and pre-fill defaults from it.
  useEffect(() => {
    getActiveProfile().then((profile) => {
      setActiveProfile(profile || null);
      if (profile?.game) setDefaultGame(profile.game);
    }).catch((err) => logger.error("failed to load active profile", { message: err?.message }));
  }, []);

  // Load existing batch if reopening — skip setup phase
  useEffect(() => {
    if (batchId) {
      getBatch(batchId).then((existing) => {
        if (existing) {
          setCards(existing.cards);
          setBatchName(existing.name);
          setCurrentBatchId(existing.id);
          if (existing.config) {
            setBatchConfig(existing.config);
            setDefaultGame(existing.config.game);
          }
          setPhase("scanning");
        }
      }).catch((err) => logger.error("failed to load batch", { batchId, message: err?.message }));
    }
  }, [batchId]);

  // Handle batch setup completion — apply config as defaults and move to scanning
  const handleBatchStart = useCallback((config: BatchConfig) => {
    setBatchConfig(config);
    setBatchName(config.name);
    setDefaultGame(config.game);
    setPhase("scanning");
  }, []);

  // Auto-save whenever cards change (debounced)
  useEffect(() => {
    if (cards.length === 0) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      try {
        const id = currentBatchId || uuid();
        if (!currentBatchId) setCurrentBatchId(id);
        const name = batchName || `Batch — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
        if (!batchName) setBatchName(name);
        const existing = await getBatch(id);
        const batch: Batch = {
          id,
          name,
          cards,
          status: "pending" as BatchStatus,
          config: batchConfig || undefined,
          createdAt: existing?.createdAt || Date.now(),
          updatedAt: Date.now(),
        };
        await saveBatch(batch);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } catch (err: any) {
        logger.error("auto-save failed", { batchId: currentBatchId, message: err?.message });
      }
    }, 1500);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [cards, currentBatchId, batchName, batchConfig]);

  // If the active profile has a listing format, build a template from it and prepend it
  // so exports use the profile's patterns by default.
  const effectiveTemplates = useMemo(() => {
    if (!activeProfile?.titlePattern) return templates;
    const profileTemplate: ListingTemplate = {
      id: `profile-${activeProfile.id}`,
      name: `Profile: ${activeProfile.name}`,
      titlePattern: activeProfile.titlePattern,
      descriptionPattern: activeProfile.descriptionPattern || "",
      platform: activeProfile.platform || "ebay",
      game: activeProfile.game,
    };
    // Prepend so findBestTemplate picks it first (it matches game + platform)
    return [profileTemplate, ...templates];
  }, [activeProfile, templates]);

  const totalValue = useMemo(
    () =>
      cards.reduce(
        (sum, c) => sum + (c.marketPriceUsd ?? 0) * (c.quantity || 1),
        0
      ),
    [cards]
  );

  // Load user pricing config for batch fee stats
  const userPricingConfig = useMemo<PricingConfig>(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("pricing_config") : null;
      return saved ? { ...DEFAULT_PRICING_CONFIG, ...JSON.parse(saved) } : DEFAULT_PRICING_CONFIG;
    } catch { return DEFAULT_PRICING_CONFIG; }
  }, []);

  // Compute fee-aware batch stats
  const batchFeeStats = useMemo(() => {
    if (cards.length === 0) return null;
    const batchPricing = computeBatchPricing(cards, userPricingConfig);
    return pricingBatchStats(batchPricing.map((bp) => bp.pricing));
  }, [cards, userPricingConfig]);

  const handleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;
      setScanning(true);
      setScanCount(files.length);
      setErrorMsg(null);

      // Resize images to avoid large uploads that break the vision API.
      const resized = await Promise.all(files.map(resizeImageFile));

      // Pre-compute thumbnails so the user sees something instantly.
      const thumbs = await Promise.all(resized.map(fileToDataUrl));

      // Build the multipart form and send all images in one request.
      const fd = new FormData();
      resized.forEach((f) => fd.append("images", f));

      // Attach scan hints from batch config and active profile so vision gets extra context.
      {
        const hints: Record<string, string | undefined> = {
          game: batchConfig?.game || activeProfile?.game,
          setName: activeProfile?.setName,
          setCode: activeProfile?.setCode,
          rarity: activeProfile?.rarity,
          foilType: activeProfile?.foilType,
          language: batchConfig?.language || activeProfile?.language,
          notes: [batchConfig?.notes, activeProfile?.notes].filter(Boolean).join("; ") || undefined,
        };
        // Include set filters from batch config
        if (batchConfig?.includeSets?.length) {
          hints.includeSets = batchConfig.includeSets.join(",");
        }
        if (batchConfig?.excludeSets?.length) {
          hints.excludeSets = batchConfig.excludeSets.join(",");
        }
        // Remove undefined values before serializing
        const cleaned = Object.fromEntries(
          Object.entries(hints).filter(([, v]) => v !== undefined)
        );
        if (Object.keys(cleaned).length > 0) {
          fd.append("hints", JSON.stringify(cleaned));
        }
      }

      try {
        const res = await fetch("/api/scan", { method: "POST", body: fd });
        if (!res.ok) {
          const { error } = await res.json().catch(() => ({ error: "Scan failed" }));
          setErrorMsg(error || "Scan failed");
          return;
        }
        const data = (await res.json()) as {
          visionEnabled: boolean;
          results: ScanResult[];
        };
        setVisionEnabled(data.visionEnabled);

        // Separate fronts from backs, then pair them.
        // Works regardless of file-picker order or separate uploads.
        const fronts: { result: ScanResult; thumb: string }[] = [];
        const backs: string[] = []; // just the thumbnails

        for (let i = 0; i < data.results.length; i++) {
          if (data.results[i].isCardBack) {
            backs.push(thumbs[i]);
          } else {
            fronts.push({ result: data.results[i], thumb: thumbs[i] });
          }
        }

        // Build card entries from fronts only
        const newCards: ScannedCard[] = fronts.map(({ result, thumb }) =>
          resultToCard(result, thumb, defaultGame, activeProfile, batchConfig)
        );

        // Pair backs with fronts (1:1 by position — back[0]→front[0], etc.)
        // Any extras attach to the first existing card that has no back photo yet.
        setCards((prev) => {
          // Start with immutable copies so we never mutate prev state objects.
          const combined: ScannedCard[] = [
            ...newCards.map((c) => ({ ...c })),
            ...prev.map((c) => ({ ...c, photos: c.photos ? [...c.photos] : [] })),
          ];

          for (let b = 0; b < backs.length; b++) {
            // Find target: match by position within new cards first,
            // then first card without a back, then very first card.
            let targetId: string | undefined;
            if (b < newCards.length) {
              targetId = newCards[b].id;
            } else {
              targetId = combined.find(
                (c) => !(c.photos || []).some((p) => p.role === "back")
              )?.id ?? combined[0]?.id;
            }
            if (!targetId) continue;
            const idx = combined.findIndex((c) => c.id === targetId);
            if (idx < 0) continue;
            const backPhoto: CardPhoto = { id: uuid(), role: "back", dataUrl: backs[b] };
            combined[idx] = {
              ...combined[idx],
              photos: [
                ...(combined[idx].photos || []).filter((p) => p.role !== "back"),
                backPhoto,
              ],
            };
          }

          return combined;
        });
      } catch (err: any) {
        setErrorMsg(err?.message || "Network error during scan");
      } finally {
        setScanning(false);
        setScanCount(0);
      }
    },
    [defaultGame, activeProfile, batchConfig]
  );

  // ── Queue-based processing for listing-mode camera captures ──────────────
  // The camera stays fully live; shots drain sequentially in the background.
  const drainQueue = useCallback(async () => {
    if (queueProcessingRef.current) return;
    queueProcessingRef.current = true;
    while (captureQueueRef.current.length > 0) {
      const files = captureQueueRef.current.shift()!;
      setQueueCount(captureQueueRef.current.length);
      await handleFiles(files);
    }
    queueProcessingRef.current = false;
    setQueueCount(0);
  }, [handleFiles]);

  const handleCameraCapture = useCallback(
    (files: File[]) => {
      if (cameraMode === "listing") {
        if (captureQueueRef.current.length >= MAX_QUEUE_DEPTH) return; // safety cap
        captureQueueRef.current.push(files);
        setQueueCount(captureQueueRef.current.length);
        drainQueue();
      } else {
        // Identify mode — process immediately (same API, same card list)
        handleFiles(files);
      }
    },
    [cameraMode, handleFiles, drainQueue]
  );

  const updateCard = useCallback((id: string, patch: Partial<ScannedCard>) => {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  }, []);

  const removeCard = useCallback((id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const relookupCard = useCallback(
    async (id: string) => {
      const card = cards.find((c) => c.id === id);
      if (!card) return;
      try {
        const res = await fetch("/api/lookup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            game: card.game,
            name: card.name,
            setCode: card.setCode,
            collectorNumber: card.collectorNumber
          })
        });
        const data = await res.json();
        if (data.found && data.match) {
          updateCard(id, {
            setName: data.match.setName ?? card.setName,
            setCode: data.match.setCode ?? card.setCode,
            collectorNumber: data.match.collectorNumber ?? card.collectorNumber,
            rarity: data.match.rarity ?? card.rarity,
            imageUrl: data.match.imageUrl ?? card.imageUrl,
            marketPriceUsd: data.match.marketPriceUsd ?? card.marketPriceUsd,
            externalUrl: data.match.externalUrl ?? card.externalUrl,
            identificationSource: card.identificationSource === "mock" ? "manual" : card.identificationSource
          });
        }
      } catch (err: any) {
        logger.error("relookup failed", { cardId: id, message: err?.message });
      }
    },
    [cards, updateCard]
  );

  // ── Setup phase: show config form ──
  // Pre-seed BatchConfig from the active scan profile so the user doesn't
  // have to re-enter game, language, condition, etc. on every new batch.
  if (phase === "setup") {
    const profileDefaults = activeProfile
      ? {
          game: activeProfile.game,
          defaultCondition: activeProfile.defaultCondition,
          language: activeProfile.language,
          notes: activeProfile.notes,
          platform: activeProfile.platform,
          // Map foilType string → CardFinish enum
          finish: (() => {
            switch (activeProfile.foilType?.toLowerCase()) {
              case "holofoil":
              case "holo":
                return "holo" as const;
              case "reverse holo":
              case "reverse-holo":
                return "reverse-holo" as const;
              case "full art":
              case "full-art":
                return "full-art" as const;
              case "etched":
                return "etched" as const;
              case "none":
              case "non-holo":
                return "non-holo" as const;
              default:
                return undefined;
            }
          })(),
        }
      : {};

    return (
      <BatchSetup
        onStart={handleBatchStart}
        initialConfig={profileDefaults}
      />
    );
  }

  // ── Scanning phase ──
  return (
    <div className="flex flex-col gap-6">
      <section className="card-panel">
        {/* Batch config summary bar */}
        {batchConfig && (
          <div className="flex items-center gap-2 flex-wrap mb-4 pb-3 border-b border-border">
            <span className="text-sm font-medium text-white">{batchConfig.name}</span>
            <span className="chip">{GAME_LABELS[batchConfig.game]}</span>
            <span className="chip">{batchConfig.defaultCondition}</span>
            <span className="chip">{batchConfig.imageMode === "front-and-back" ? "Front + Back" : "Front only"}</span>
            {batchConfig.floorPrice != null && batchConfig.floorPrice > 0 && (
              <span className="chip">Floor: ${batchConfig.floorPrice.toFixed(2)}</span>
            )}
            {batchConfig.priceMultiplier !== 1.0 && (
              <span className="chip">{batchConfig.priceMultiplier}x</span>
            )}
          </div>
        )}

        {/* Input mode tabs */}
        <div className="flex items-center gap-1 mb-4 p-1 bg-panel2 rounded-lg w-fit">
          <button
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              inputMode === "upload"
                ? "bg-panel border border-border text-white shadow-sm"
                : "text-muted hover:text-white"
            }`}
            onClick={() => setInputMode("upload")}
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
          <button
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              inputMode === "camera"
                ? "bg-panel border border-border text-white shadow-sm"
                : "text-muted hover:text-white"
            }`}
            onClick={() => setInputMode("camera")}
          >
            <Camera className="w-4 h-4" />
            Camera
          </button>
        </div>

        {/* Camera sub-mode toggle — only shown when camera is selected */}
        {inputMode === "camera" && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-5">
            <div className="flex items-center gap-1 p-0.5 bg-panel2/60 rounded-lg w-fit border border-border/50">
              <button
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  cameraMode === "listing"
                    ? "bg-panel border border-border text-white shadow-sm"
                    : "text-muted hover:text-white"
                }`}
                onClick={() => setCameraMode("listing")}
              >
                <Layers className="w-3.5 h-3.5" />
                Listing
              </button>
              <button
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  cameraMode === "identify"
                    ? "bg-panel border border-border text-white shadow-sm"
                    : "text-muted hover:text-white"
                }`}
                onClick={() => setCameraMode("identify")}
              >
                <Scan className="w-3.5 h-3.5" />
                Identify
              </button>
            </div>
            <p className="text-xs text-muted">
              {cameraMode === "listing"
                ? "Tap shutter after each card — camera stays live, shots queue in background."
                : "Hold a card steady — auto-captures when detected. Great for quick pricing."}
            </p>
            {/* Queue count badge */}
            {cameraMode === "listing" && (queueCount > 0 || scanning) && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent text-xs font-medium">
                <Loader2 className="w-3 h-3 animate-spin" />
                {queueCount > 0 ? `${queueCount + (scanning ? 1 : 0)} in queue` : "Processing…"}
              </span>
            )}
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1">
            {inputMode === "upload" ? (
              <UploadDropzone onFiles={handleFiles} busy={scanning} scanCount={scanCount} />
            ) : (
              <CameraScanner
                onCapture={handleCameraCapture}
                // Listing mode: camera is never blocked — shots queue silently.
                // Identify mode: show busy overlay between auto-captures.
                busy={cameraMode === "identify" ? scanning : false}
                mode={cameraMode}
              />
            )}
          </div>
          <aside className="lg:w-80 flex flex-col gap-3">
            <div>
              <label className="label">Default game (if undetected)</label>
              <select
                className="input mt-1"
                value={defaultGame}
                onChange={(e) => setDefaultGame(e.target.value as Game)}
              >
                {(Object.keys(GAME_LABELS) as Game[]).map((g) => (
                  <option key={g} value={g}>
                    {GAME_LABELS[g]}
                  </option>
                ))}
              </select>
            </div>
            {activeProfile && (
              <div className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full bg-accent" />
                <span className="text-accent font-medium">Profile:</span>
                <span className="text-muted">{activeProfile.name}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-xs text-muted">
              <span
                className={`w-2 h-2 rounded-full ${
                  visionEnabled === null
                    ? "bg-muted"
                    : visionEnabled
                    ? "bg-accent2"
                    : "bg-danger"
                }`}
              />
              {visionEnabled === null
                ? "Vision status: unknown — scan a card to check"
                : visionEnabled
                ? "Vision enabled — scans use Claude"
                : "Vision disabled — manual entry only"}
            </div>
            <div className="text-xs text-muted">
              <span className="chip">Pokémon · API</span>{" "}
              <span className="chip">MTG · API</span>{" "}
              <span className="chip">Yu-Gi-Oh · API</span>{" "}
              <span className="chip">One Piece · API</span>{" "}
              <span className="chip">Digimon · API</span>{" "}
              <span className="chip">Lorcana · API</span>
            </div>
          </aside>
        </div>
        {errorMsg && (
          <p className="mt-4 text-sm text-danger border border-danger/40 bg-danger/10 rounded-md px-3 py-2">
            {errorMsg}
          </p>
        )}
      </section>

      <section className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4 flex-wrap">
          <h2 className="text-lg font-semibold">Scanned cards</h2>
          <span className="chip">{cards.length} total</span>
          <span className="chip">
            Est. value: ${totalValue.toFixed(2)}
          </span>
          {batchFeeStats && batchFeeStats.totalListValue > 0 && (
            <>
              <span className="chip">
                List: ${batchFeeStats.totalListValue.toFixed(2)}
              </span>
              <span className="chip">
                Fees: <span className="text-red-400">-${batchFeeStats.totalFees.toFixed(2)}</span>
              </span>
              <span
                className={`chip ${
                  batchFeeStats.totalNetProfit < 0
                    ? "bg-red-500/10 border-red-500/30 text-red-400"
                    : batchFeeStats.avgMarginPercent < 10
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                    : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
                }`}
              >
                Profit: {batchFeeStats.totalNetProfit < 0 ? "-" : ""}$
                {Math.abs(batchFeeStats.totalNetProfit).toFixed(2)}{" "}
                ({batchFeeStats.avgMarginPercent.toFixed(0)}%)
              </span>
              {batchFeeStats.lossCount > 0 && (
                <span className="chip bg-red-500/10 border-red-500/30 text-red-400">
                  {batchFeeStats.lossCount} at loss
                </span>
              )}
              <span className="chip text-muted text-[10px]">
                via {PLATFORM_FEES[userPricingConfig.targetPlatform]?.label || "eBay"}
              </span>
            </>
          )}
          {saved && (
            <span className="inline-flex items-center gap-1 text-xs text-accent2">
              <Check className="w-3 h-3" /> Saved
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {cards.length > 0 && (
            <input
              className="input text-sm w-52"
              placeholder="Batch name…"
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
            />
          )}
          {cards.length > 1 && (
            <button
              className={`btn text-xs ${duplicateCount > 0 ? "border-accent/40 text-accent" : ""}`}
              onClick={() => setShowDuplicates(true)}
            >
              <Copy className="w-3.5 h-3.5" />
              {duplicateCount > 0 ? `${duplicateCount} duplicate${duplicateCount > 1 ? "s" : ""}` : "Check duplicates"}
            </button>
          )}
          <ExportBar
          cards={cards}
          templates={effectiveTemplates}
          ebayConnected={ebayConnected}
          onEbayListAll={(result: EbayBulkResult) => {
            // Mark each successfully listed card with its eBay listing ID.
            // SKU format is tcg-${card.id} (see lib/ebay/listings.ts).
            result.items.forEach(({ sku, listingId, success }) => {
              if (!success || !listingId) return;
              const cardId = sku.startsWith("tcg-") ? sku.slice(4) : sku;
              updateCard(cardId, { ebayListingId: listingId });
            });
          }}
        />
        </div>
      </section>

      {cards.length > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl border border-amber-500/30 bg-amber-500/5 text-sm">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-amber-200/90">
            <span className="font-medium text-amber-300">AI-assisted results — verify before listing.</span>{" "}
            Card names, sets, and prices are estimates. Always confirm details match the
            physical card before listing or selling.
          </p>
        </div>
      )}

      {showDuplicates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="card-panel max-w-xl w-full max-h-[80vh] overflow-y-auto p-6">
            <DuplicateReview
              cards={cards}
              onResolve={(updated) => {
                setCards(updated);
                setShowDuplicates(false);
              }}
              onDismiss={() => setShowDuplicates(false)}
            />
          </div>
        </div>
      )}

      <CardList
        cards={cards}
        onChange={updateCard}
        onRemove={removeCard}
        onRelookup={relookupCard}
        onVerify={(id) => {
          const idx = cards.findIndex((c) => c.id === id);
          if (idx >= 0) setVerifyIndex(idx);
        }}
        ebayConnected={ebayConnected}
      />

      {/* Card verification modal */}
      {verifyIndex !== null && cards[verifyIndex] && (
        <CardVerification
          card={cards[verifyIndex]}
          cards={cards}
          currentIndex={verifyIndex}
          onApply={(cardId, patch) => updateCard(cardId, patch)}
          onNavigate={setVerifyIndex}
          onClose={() => setVerifyIndex(null)}
        />
      )}

      {cards.length > 0 && (
        <ListingEditor
          cards={cards}
          templates={effectiveTemplates}
          onTemplatesChange={setTemplates}
        />
      )}
    </div>
  );
}

// Map a single ScanResult + thumbnail into a ScannedCard in the UI state.
// Batch config takes priority over profile defaults for condition, language, etc.
function resultToCard(
  r: ScanResult,
  thumb: string,
  fallbackGame: Game,
  profile?: ScanProfile | null,
  config?: BatchConfig | null
): ScannedCard {
  const match = r.matchedCard;
  const guess: VisionGuess | undefined = r.visionGuess;
  const game: Game = match?.game || guess?.game || config?.game || fallbackGame;
  const name = match?.name || guess?.name || "";

  const source: ScannedCard["identificationSource"] = match
    ? guess
      ? "vision"
      : "manual"
    : guess
    ? "vision"
    : "manual";

  // Priority: batch config > AI estimate from scan > profile default > "Near Mint"
  const condition: Condition =
    config?.defaultCondition ||
    (guess?.conditionEstimate as Condition | null | undefined) ||
    (profile?.defaultCondition as Condition) ||
    "Near Mint";
  const language = guess?.language || config?.language || profile?.language || "English";

  // Determine foil from batch config finish, then profile, then default false
  let foil = false;
  if (config?.finish && config.finish !== "non-holo" && config.finish !== "any") {
    foil = true;
  } else if (profile?.foilType) {
    foil = profile.foilType !== "None";
  }

  // If batch config is for graded cards, pre-set slabbed flag
  const slabbed = config?.cardType === "graded" ? true : undefined;

  const cardId = uuid();
  return {
    id: cardId,
    game,
    name,
    setName: match?.setName || guess?.setName || undefined,
    setCode: match?.setCode || guess?.setCode || undefined,
    collectorNumber: match?.collectorNumber || guess?.collectorNumber || undefined,
    rarity: match?.rarity,
    imageUrl: match?.imageUrl,
    uploadedImageDataUrl: thumb,
    photos: [{ id: uuid(), role: "front" as const, dataUrl: thumb }],
    marketPriceUsd: match?.marketPriceUsd,
    condition,
    quantity: 1,
    foil,
    language,
    slabbed,
    notes: r.note,
    identificationSource: source,
    identificationConfidence: guess?.confidence,
    externalUrl: match?.externalUrl,
    createdAt: Date.now()
  };
}
