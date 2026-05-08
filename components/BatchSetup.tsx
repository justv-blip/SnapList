"use client";

import { useState } from "react";
import {
  Play,
  Tag,
  Layers,
  DollarSign,
  ImageIcon,
  Settings2,
  ChevronDown,
  ChevronUp,
  X,
  Plus,
  Zap,
  Package,
  Star,
  TrendingDown,
  BarChart2,
  Globe,
  SlidersHorizontal,
} from "lucide-react";
import type {
  BatchConfig,
  Game,
  Condition,
  CardType,
  CardFinish,
  ImageMode,
  ExportPlatform,
  ListingTemplate,
} from "@/lib/types";
import {
  GAME_LABELS,
  CONDITIONS,
  CARD_TYPE_LABELS,
  CARD_FINISH_LABELS,
  PLATFORM_LABELS,
  DEFAULT_BATCH_CONFIG,
} from "@/lib/types";
import { DEFAULT_TEMPLATES } from "@/lib/templates";
import {
  PRICING_STRATEGY_LABELS,
  PRICING_STRATEGY_DESCRIPTIONS,
  ROUNDING_LABELS,
  type PricingStrategy,
  type RoundingRule,
} from "@/lib/pricingEngine";

export interface BatchSetupProps {
  onStart: (config: BatchConfig) => void;
  onCancel?: () => void;
  initialConfig?: Partial<BatchConfig>;
}

// ─── Quick presets ─────────────────────────────────────────────────────────
const QUICK_PRESETS: {
  label: string;
  description: string;
  icon: React.ReactNode;
  config: Partial<BatchConfig>;
}[] = [
  {
    label: "Pokémon NM",
    description: "Singles, Near Mint, match market",
    icon: <Zap className="w-3.5 h-3.5" />,
    config: {
      game: "pokemon",
      cardType: "single",
      defaultCondition: "Near Mint",
      finish: "any",
      imageMode: "front-only",
      pricingStrategy: "MATCH_MARKET",
      priceMultiplier: 1.0,
    },
  },
  {
    label: "MTG Bulk",
    description: "Lightly Played, undercut by 5%",
    icon: <TrendingDown className="w-3.5 h-3.5" />,
    config: {
      game: "mtg",
      cardType: "single",
      defaultCondition: "Lightly Played",
      finish: "non-holo",
      imageMode: "front-only",
      pricingStrategy: "UNDERCUT",
      undercutPercent: 5,
    },
  },
  {
    label: "Graded Slabs",
    description: "Front + back, match market",
    icon: <Star className="w-3.5 h-3.5" />,
    config: {
      cardType: "graded",
      imageMode: "front-and-back",
      pricingStrategy: "MATCH_MARKET",
      priceMultiplier: 1.0,
    },
  },
  {
    label: "Sealed Product",
    description: "Boxes / ETBs, 10% markup",
    icon: <Package className="w-3.5 h-3.5" />,
    config: {
      cardType: "sealed",
      imageMode: "front-only",
      pricingStrategy: "MARKUP",
      priceMultiplier: 1.1,
    },
  },
  {
    label: "Quick Sell",
    description: "Move inventory fast, −10%",
    icon: <BarChart2 className="w-3.5 h-3.5" />,
    config: {
      pricingStrategy: "VELOCITY",
      undercutPercent: 10,
    },
  },
];

// ─── Strategy meta (icon + color) ─────────────────────────────────────────
const STRATEGY_META: Record<PricingStrategy, { color: string }> = {
  MATCH_MARKET:   { color: "border-accent/40 text-accent bg-accent/[0.08]" },
  UNDERCUT:       { color: "border-blue-500/40 text-blue-400 bg-blue-500/[0.08]" },
  VELOCITY:       { color: "border-amber-500/40 text-amber-400 bg-amber-500/[0.08]" },
  MARKUP:         { color: "border-purple-500/40 text-purple-400 bg-purple-500/[0.08]" },
  FLOOR_CEILING:  { color: "border-emerald-500/40 text-emerald-400 bg-emerald-500/[0.08]" },
};

const LANGUAGES = [
  "English", "Japanese", "Korean",
  "Chinese (Simplified)", "Chinese (Traditional)",
  "French", "German", "Italian", "Portuguese", "Spanish",
];

export default function BatchSetup({ onStart, onCancel, initialConfig }: BatchSetupProps) {
  const [config, setConfig] = useState<BatchConfig>({
    ...DEFAULT_BATCH_CONFIG,
    ...initialConfig,
  });

  const [showSets, setShowSets] = useState(false);
  const [showPlatform, setShowPlatform] = useState(false);
  const [includeSetInput, setIncludeSetInput] = useState("");
  const [excludeSetInput, setExcludeSetInput] = useState("");
  const [appliedPreset, setAppliedPreset] = useState<string | null>(null);

  const patch = (updates: Partial<BatchConfig>) =>
    setConfig((prev) => ({ ...prev, ...updates }));

  const applyPreset = (preset: (typeof QUICK_PRESETS)[number]) => {
    patch(preset.config);
    setAppliedPreset(preset.label);
  };

  const addIncludeSet = () => {
    const val = includeSetInput.trim();
    if (val && !config.includeSets.includes(val))
      patch({ includeSets: [...config.includeSets, val] });
    setIncludeSetInput("");
  };

  const removeIncludeSet = (s: string) =>
    patch({ includeSets: config.includeSets.filter((x) => x !== s) });

  const addExcludeSet = () => {
    const val = excludeSetInput.trim();
    if (val && !config.excludeSets.includes(val))
      patch({ excludeSets: [...config.excludeSets, val] });
    setExcludeSetInput("");
  };

  const removeExcludeSet = (s: string) =>
    patch({ excludeSets: config.excludeSets.filter((x) => x !== s) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalConfig: BatchConfig = {
      ...config,
      name:
        config.name.trim() ||
        `Batch — ${new Date().toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })}`,
    };
    onStart(finalConfig);
  };

  const templates: ListingTemplate[] = DEFAULT_TEMPLATES;
  const activeStrategy = (config.pricingStrategy || "MATCH_MARKET") as PricingStrategy;

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto">

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold tracking-tight">New Batch</h2>
          <p className="text-xs text-muted mt-1">
            Configure once, scan everything
          </p>
        </div>
        {onCancel && (
          <button type="button" className="btn text-xs" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      {/* ── Quick Presets ── */}
      <div className="mb-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted mb-2.5">
          Quick Start
        </p>
        <div className="flex flex-wrap gap-2">
          {QUICK_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                appliedPreset === p.label
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-panel2 text-muted hover:text-white hover:border-border/80"
              }`}
              title={p.description}
            >
              {p.icon}
              {p.label}
            </button>
          ))}
        </div>
        {appliedPreset && (
          <p className="text-[10px] text-accent mt-2">
            ✓ {QUICK_PRESETS.find((p) => p.label === appliedPreset)?.description} — adjust any field below
          </p>
        )}
      </div>

      {/* ── Batch Name ── */}
      <div className="card-panel mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Tag className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Batch Name</span>
        </div>
        <input
          className="input"
          placeholder="e.g. Surging Sparks Holos, PSA 10 Lots…"
          value={config.name}
          onChange={(e) => patch({ name: e.target.value })}
          autoFocus
        />
      </div>

      {/* ── Section 1: Card Details ── */}
      <div className="card-panel mb-4">
        <div className="flex items-center gap-2 mb-4">
          <Layers className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Card Details</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* TCG */}
          <div>
            <label className="label text-[11px]">TCG / Game</label>
            <select
              className="input mt-1 text-sm"
              value={config.game}
              onChange={(e) => patch({ game: e.target.value as Game })}
            >
              {(Object.keys(GAME_LABELS) as Game[]).map((g) => (
                <option key={g} value={g}>{GAME_LABELS[g]}</option>
              ))}
            </select>
          </div>

          {/* Card Type */}
          <div>
            <label className="label text-[11px]">Card Type</label>
            <select
              className="input mt-1 text-sm"
              value={config.cardType}
              onChange={(e) => patch({ cardType: e.target.value as CardType })}
            >
              {(Object.entries(CARD_TYPE_LABELS) as [CardType, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Condition */}
          <div>
            <label className="label text-[11px]">Condition</label>
            <select
              className="input mt-1 text-sm"
              value={config.defaultCondition}
              onChange={(e) => patch({ defaultCondition: e.target.value as Condition })}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Finish */}
          <div>
            <label className="label text-[11px]">Finish / Foil</label>
            <select
              className="input mt-1 text-sm"
              value={config.finish}
              onChange={(e) => patch({ finish: e.target.value as CardFinish })}
            >
              {(Object.entries(CARD_FINISH_LABELS) as [CardFinish, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Language */}
          <div>
            <label className="label text-[11px]">Language</label>
            <select
              className="input mt-1 text-sm"
              value={config.language}
              onChange={(e) => patch({ language: e.target.value })}
            >
              {LANGUAGES.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {/* Image Mode */}
          <div>
            <label className="label text-[11px]">
              <ImageIcon className="w-3 h-3 inline mr-1" />
              Photos
            </label>
            <div className="flex gap-1.5 mt-1">
              {(["front-only", "front-and-back"] as ImageMode[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => patch({ imageMode: m })}
                  className={`flex-1 py-1.5 px-2 rounded-lg border text-[11px] font-medium transition-colors ${
                    config.imageMode === m
                      ? "border-accent/50 bg-accent/10 text-accent"
                      : "border-border bg-panel2 text-muted hover:text-white"
                  }`}
                >
                  {m === "front-only" ? "Front only" : "Front + Back"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section 2: Pricing ── */}
      <div className="card-panel mb-4">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted">Pricing</span>
        </div>

        {/* Strategy pills */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {(Object.keys(PRICING_STRATEGY_LABELS) as PricingStrategy[]).map((s) => {
            const isActive = activeStrategy === s;
            const meta = STRATEGY_META[s] || STRATEGY_META.MATCH_MARKET;
            return (
              <button
                key={s}
                type="button"
                onClick={() => patch({ pricingStrategy: s })}
                className={`text-left px-3 py-2.5 rounded-xl border text-xs transition-all ${
                  isActive
                    ? meta.color + " border-opacity-100"
                    : "border-border bg-panel2 text-muted hover:text-white hover:border-border/80"
                }`}
              >
                <div className="font-semibold mb-0.5">{PRICING_STRATEGY_LABELS[s]}</div>
                <div className="text-[10px] opacity-70 leading-tight">{PRICING_STRATEGY_DESCRIPTIONS[s]}</div>
              </button>
            );
          })}
        </div>

        {/* Strategy-specific inputs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {/* Floor */}
          <div>
            <label className="label text-[11px]">Floor Price ($)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              className="input mt-1 text-sm"
              placeholder="0.99"
              value={config.floorPrice ?? ""}
              onChange={(e) => patch({ floorPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>

          {/* Ceiling */}
          <div>
            <label className="label text-[11px]">Ceiling Price ($)</label>
            <input
              type="number"
              step="1"
              min="0"
              className="input mt-1 text-sm"
              placeholder="0 = no limit"
              value={config.ceilingPrice ?? ""}
              onChange={(e) => patch({ ceilingPrice: e.target.value ? parseFloat(e.target.value) : undefined })}
            />
          </div>

          {/* Rounding */}
          <div>
            <label className="label text-[11px]">Rounding</label>
            <select
              className="input mt-1 text-sm"
              value={config.priceRounding || "end_99"}
              onChange={(e) => patch({ priceRounding: e.target.value })}
            >
              {(Object.entries(ROUNDING_LABELS) as [RoundingRule, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* Undercut % */}
          {(activeStrategy === "UNDERCUT" || activeStrategy === "VELOCITY") && (
            <div>
              <label className="label text-[11px]">
                {activeStrategy === "VELOCITY" ? "Discount (%)" : "Undercut (%)"}
              </label>
              <input
                type="number"
                step="1"
                min="1"
                max="50"
                className="input mt-1 text-sm"
                placeholder="5"
                value={config.undercutPercent ?? 5}
                onChange={(e) => patch({ undercutPercent: parseInt(e.target.value) || 5 })}
              />
            </div>
          )}

          {/* Markup % */}
          {activeStrategy === "MARKUP" && (
            <div>
              <label className="label text-[11px]">Markup (%)</label>
              <input
                type="number"
                step="1"
                min="1"
                max="200"
                className="input mt-1 text-sm"
                placeholder="10"
                value={Math.round((config.priceMultiplier - 1) * 100)}
                onChange={(e) => patch({ priceMultiplier: 1 + (parseInt(e.target.value) || 0) / 100 })}
              />
            </div>
          )}

          {/* Multiplier for non-markup strategies */}
          {activeStrategy !== "MARKUP" && (
            <div>
              <label className="label text-[11px]">Price Multiplier</label>
              <input
                type="number"
                step="0.05"
                min="0.1"
                className="input mt-1 text-sm"
                placeholder="1.0"
                value={config.priceMultiplier}
                onChange={(e) => patch({ priceMultiplier: parseFloat(e.target.value) || 1.0 })}
              />
              <p className="text-[10px] text-muted mt-0.5">1.0 = market · 1.1 = +10%</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 3: Set Filters (collapsible) ── */}
      <div className="card-panel mb-4">
        <button
          type="button"
          onClick={() => setShowSets((v) => !v)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-muted" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Set Filters
            </span>
            {(config.includeSets.length > 0 || config.excludeSets.length > 0) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30">
                {config.includeSets.length + config.excludeSets.length} active
              </span>
            )}
          </div>
          {showSets ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted" />
          )}
        </button>

        {showSets && (
          <div className="mt-4 space-y-4">
            {/* Include */}
            <div>
              <label className="label text-[11px]">Include Sets (leave empty = all)</label>
              <div className="flex gap-2 mt-1">
                <input
                  className="input flex-1 text-sm"
                  placeholder="Set name or code…"
                  value={includeSetInput}
                  onChange={(e) => setIncludeSetInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIncludeSet(); } }}
                />
                <button type="button" className="btn px-3" onClick={addIncludeSet}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {config.includeSets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {config.includeSets.map((s) => (
                    <span
                      key={s}
                      className="chip group cursor-pointer"
                      onClick={() => removeIncludeSet(s)}
                    >
                      {s}
                      <X className="w-3 h-3 text-muted group-hover:text-danger transition-colors" />
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Exclude */}
            <div>
              <label className="label text-[11px]">Exclude Sets</label>
              <div className="flex gap-2 mt-1">
                <input
                  className="input flex-1 text-sm"
                  placeholder="Set name or code…"
                  value={excludeSetInput}
                  onChange={(e) => setExcludeSetInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExcludeSet(); } }}
                />
                <button type="button" className="btn px-3" onClick={addExcludeSet}>
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              {config.excludeSets.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {config.excludeSets.map((s) => (
                    <span
                      key={s}
                      className="chip group cursor-pointer"
                      onClick={() => removeExcludeSet(s)}
                    >
                      {s}
                      <X className="w-3 h-3 text-muted group-hover:text-danger transition-colors" />
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Section 4: Platform & Listing (collapsible) ── */}
      <div className="card-panel mb-5">
        <button
          type="button"
          onClick={() => setShowPlatform((v) => !v)}
          className="w-full flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <Settings2 className="w-3.5 h-3.5 text-muted" />
            <span className="text-xs font-semibold uppercase tracking-wider text-muted">
              Platform &amp; Listing
            </span>
            {(config.platform || config.templateId || config.ebayCategoryId) && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/30">
                configured
              </span>
            )}
          </div>
          {showPlatform ? (
            <ChevronUp className="w-3.5 h-3.5 text-muted" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-muted" />
          )}
        </button>

        {showPlatform && (
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="label text-[11px]">
                <Globe className="w-3 h-3 inline mr-1" />
                Target Platform
              </label>
              <select
                className="input mt-1 text-sm"
                value={config.platform || ""}
                onChange={(e) =>
                  patch({ platform: (e.target.value || undefined) as ExportPlatform | undefined })
                }
              >
                <option value="">None selected</option>
                {(Object.entries(PLATFORM_LABELS) as [ExportPlatform, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-[11px]">Listing Template</label>
              <select
                className="input mt-1 text-sm"
                value={config.templateId || ""}
                onChange={(e) => patch({ templateId: e.target.value || undefined })}
              >
                <option value="">Auto-select</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label text-[11px]">eBay Store Category</label>
              <input
                className="input mt-1 text-sm"
                placeholder="Category name…"
                value={config.ebayCategoryName || ""}
                onChange={(e) => patch({ ebayCategoryName: e.target.value || undefined })}
              />
            </div>

            <div>
              <label className="label text-[11px]">eBay Category ID</label>
              <input
                className="input mt-1 text-sm"
                placeholder="e.g. 183454"
                value={config.ebayCategoryId || ""}
                onChange={(e) => patch({ ebayCategoryId: e.target.value || undefined })}
              />
            </div>

            <div className="sm:col-span-2">
              <label className="label text-[11px]">
                <SlidersHorizontal className="w-3 h-3 inline mr-1" />
                Notes / Vision Context
              </label>
              <textarea
                className="input mt-1 min-h-[64px] resize-y text-sm"
                placeholder="Extra context passed to AI during scanning and listing generation…"
                value={config.notes || ""}
                onChange={(e) => patch({ notes: e.target.value || undefined })}
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Live Summary ── */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <span className="chip text-xs">{GAME_LABELS[config.game]}</span>
        <span className="chip text-xs">{CARD_TYPE_LABELS[config.cardType]}</span>
        <span className="chip text-xs">{config.defaultCondition}</span>
        <span className="chip text-xs">{CARD_FINISH_LABELS[config.finish]}</span>
        <span className="chip text-xs">
          {config.imageMode === "front-and-back" ? "Front + Back" : "Front only"}
        </span>
        <span className="chip text-xs">{config.language}</span>
        {activeStrategy !== "MATCH_MARKET" && (
          <span className="chip text-xs text-accent border-accent/30 bg-accent/5">
            {PRICING_STRATEGY_LABELS[activeStrategy]}
          </span>
        )}
        {config.priceMultiplier !== 1.0 && (
          <span className="chip text-xs">{config.priceMultiplier}x</span>
        )}
        {config.floorPrice != null && config.floorPrice > 0 && (
          <span className="chip text-xs">Floor ${config.floorPrice.toFixed(2)}</span>
        )}
        {config.ceilingPrice != null && config.ceilingPrice > 0 && (
          <span className="chip text-xs">Cap ${config.ceilingPrice.toFixed(2)}</span>
        )}
        {(config.includeSets.length > 0 || config.excludeSets.length > 0) && (
          <span className="chip text-xs">
            {config.includeSets.length} include · {config.excludeSets.length} exclude
          </span>
        )}
        {config.platform && (
          <span className="chip text-xs">{PLATFORM_LABELS[config.platform]}</span>
        )}
      </div>

      {/* ── Start Button ── */}
      <button
        type="submit"
        className="btn-primary w-full justify-center py-3 text-sm font-semibold"
      >
        <Play className="w-4 h-4" />
        Start Scanning
      </button>
    </form>
  );
}
