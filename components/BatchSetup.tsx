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

export default function BatchSetup({ onStart, onCancel, initialConfig }: BatchSetupProps) {
  const [config, setConfig] = useState<BatchConfig>({
    ...DEFAULT_BATCH_CONFIG,
    ...initialConfig,
  });

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [includeSetInput, setIncludeSetInput] = useState("");
  const [excludeSetInput, setExcludeSetInput] = useState("");

  const patch = (updates: Partial<BatchConfig>) =>
    setConfig((prev) => ({ ...prev, ...updates }));

  const addIncludeSet = () => {
    const val = includeSetInput.trim();
    if (val && !config.includeSets.includes(val)) {
      patch({ includeSets: [...config.includeSets, val] });
    }
    setIncludeSetInput("");
  };

  const removeIncludeSet = (s: string) =>
    patch({ includeSets: config.includeSets.filter((x) => x !== s) });

  const addExcludeSet = () => {
    const val = excludeSetInput.trim();
    if (val && !config.excludeSets.includes(val)) {
      patch({ excludeSets: [...config.excludeSets, val] });
    }
    setExcludeSetInput("");
  };

  const removeExcludeSet = (s: string) =>
    patch({ excludeSets: config.excludeSets.filter((x) => x !== s) });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Ensure a batch name exists
    const finalConfig: BatchConfig = {
      ...config,
      name: config.name.trim() || `Batch — ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`,
    };
    onStart(finalConfig);
  };

  const templates: ListingTemplate[] = DEFAULT_TEMPLATES;

  return (
    <form onSubmit={handleSubmit} className="card-panel max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">New Batch</h2>
          <p className="text-xs text-muted mt-1">
            Configure your scan session before you start
          </p>
        </div>
        {onCancel && (
          <button type="button" className="btn text-xs" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>

      {/* ── Batch Name ── */}
      <div className="mb-5">
        <label className="label" htmlFor="batch-name">
          <Tag className="w-3 h-3 inline mr-1" />
          Batch Name
        </label>
        <input
          id="batch-name"
          className="input mt-1"
          placeholder="e.g. Surging Sparks Holos"
          value={config.name}
          onChange={(e) => patch({ name: e.target.value })}
          autoFocus
        />
      </div>

      {/* ── Two-column grid for core settings ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5">
        {/* TCG Selection */}
        <div>
          <label className="label" htmlFor="batch-game">TCG / Game</label>
          <select
            id="batch-game"
            className="input mt-1"
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
          <label className="label" htmlFor="batch-card-type">Card Type</label>
          <select
            id="batch-card-type"
            className="input mt-1"
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
          <label className="label" htmlFor="batch-condition">Default Condition</label>
          <select
            id="batch-condition"
            className="input mt-1"
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
          <label className="label" htmlFor="batch-finish">Finish / Foil</label>
          <select
            id="batch-finish"
            className="input mt-1"
            value={config.finish}
            onChange={(e) => patch({ finish: e.target.value as CardFinish })}
          >
            {(Object.entries(CARD_FINISH_LABELS) as [CardFinish, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>

        {/* Image Mode */}
        <div>
          <label className="label" htmlFor="batch-image-mode">
            <ImageIcon className="w-3 h-3 inline mr-1" />
            Image Mode
          </label>
          <select
            id="batch-image-mode"
            className="input mt-1"
            value={config.imageMode}
            onChange={(e) => patch({ imageMode: e.target.value as ImageMode })}
          >
            <option value="front-only">Front only</option>
            <option value="front-and-back">Front + Back</option>
          </select>
        </div>

        {/* Language */}
        <div>
          <label className="label" htmlFor="batch-language">Language</label>
          <select
            id="batch-language"
            className="input mt-1"
            value={config.language}
            onChange={(e) => patch({ language: e.target.value })}
          >
            {["English", "Japanese", "Korean", "Chinese (Simplified)", "Chinese (Traditional)", "French", "German", "Italian", "Portuguese", "Spanish"].map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Sets Include / Exclude ── */}
      <div className="mb-5">
        <label className="label">
          <Layers className="w-3 h-3 inline mr-1" />
          Sets to Include (leave empty for all)
        </label>
        <div className="flex gap-2 mt-1">
          <input
            className="input flex-1"
            placeholder="Set name or code…"
            value={includeSetInput}
            onChange={(e) => setIncludeSetInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addIncludeSet(); } }}
          />
          <button type="button" className="btn" onClick={addIncludeSet}>
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {config.includeSets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {config.includeSets.map((s) => (
              <span key={s} className="chip group cursor-pointer" onClick={() => removeIncludeSet(s)}>
                {s}
                <X className="w-3 h-3 text-muted group-hover:text-danger transition-colors" />
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="mb-5">
        <label className="label">
          <Layers className="w-3 h-3 inline mr-1" />
          Sets to Exclude
        </label>
        <div className="flex gap-2 mt-1">
          <input
            className="input flex-1"
            placeholder="Set name or code…"
            value={excludeSetInput}
            onChange={(e) => setExcludeSetInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addExcludeSet(); } }}
          />
          <button type="button" className="btn" onClick={addExcludeSet}>
            <Plus className="w-4 h-4" />
          </button>
        </div>
        {config.excludeSets.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {config.excludeSets.map((s) => (
              <span key={s} className="chip group cursor-pointer" onClick={() => removeExcludeSet(s)}>
                {s}
                <X className="w-3 h-3 text-muted group-hover:text-danger transition-colors" />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ── Smart Pricing ── */}
      <div className="mb-5">
        <label className="label mb-2 block">
          <DollarSign className="w-3 h-3 inline mr-1" />
          Pricing Strategy
        </label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
          {(Object.keys(PRICING_STRATEGY_LABELS) as PricingStrategy[]).map((s) => (
            <button
              key={s}
              type="button"
              className={`text-left px-3 py-2 rounded-lg border text-xs transition-colors ${
                (config.pricingStrategy || "MATCH_MARKET") === s
                  ? "border-accent bg-accent/10 text-accent"
                  : "border-border bg-panel2 text-muted hover:text-white hover:border-border"
              }`}
              onClick={() => patch({ pricingStrategy: s })}
            >
              <div className="font-medium">{PRICING_STRATEGY_LABELS[s]}</div>
              <div className="text-[10px] mt-0.5 opacity-70">{PRICING_STRATEGY_DESCRIPTIONS[s]}</div>
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="batch-floor">Floor Price ($)</label>
            <input
              id="batch-floor"
              type="number"
              step="0.01"
              min="0"
              className="input mt-1"
              placeholder="0.99"
              value={config.floorPrice ?? ""}
              onChange={(e) =>
                patch({ floorPrice: e.target.value ? parseFloat(e.target.value) : undefined })
              }
            />
            <p className="text-[10px] text-muted mt-1">Min listing price</p>
          </div>
          <div>
            <label className="label" htmlFor="batch-ceiling">Ceiling Price ($)</label>
            <input
              id="batch-ceiling"
              type="number"
              step="1"
              min="0"
              className="input mt-1"
              placeholder="0 = no limit"
              value={config.ceilingPrice ?? ""}
              onChange={(e) =>
                patch({ ceilingPrice: e.target.value ? parseFloat(e.target.value) : undefined })
              }
            />
            <p className="text-[10px] text-muted mt-1">Max listing price (0 = none)</p>
          </div>

          {/* Show undercut % when UNDERCUT or VELOCITY is selected */}
          {(config.pricingStrategy === "UNDERCUT" || config.pricingStrategy === "VELOCITY") && (
            <div>
              <label className="label" htmlFor="batch-undercut">
                {config.pricingStrategy === "VELOCITY" ? "Quick Sell Discount (%)" : "Undercut (%)"}
              </label>
              <input
                id="batch-undercut"
                type="number"
                step="1"
                min="1"
                max="50"
                className="input mt-1"
                placeholder="5"
                value={config.undercutPercent ?? 5}
                onChange={(e) =>
                  patch({ undercutPercent: parseInt(e.target.value) || 5 })
                }
              />
            </div>
          )}

          {/* Show markup when MARKUP is selected */}
          {config.pricingStrategy === "MARKUP" && (
            <div>
              <label className="label" htmlFor="batch-multiplier">Markup (%)</label>
              <input
                id="batch-multiplier"
                type="number"
                step="1"
                min="1"
                max="200"
                className="input mt-1"
                placeholder="10"
                value={Math.round((config.priceMultiplier - 1) * 100)}
                onChange={(e) =>
                  patch({ priceMultiplier: 1 + (parseInt(e.target.value) || 0) / 100 })
                }
              />
            </div>
          )}

          {/* Always show multiplier for non-strategy-specific use */}
          {config.pricingStrategy !== "MARKUP" && (
            <div>
              <label className="label" htmlFor="batch-multiplier">Price Multiplier</label>
              <input
                id="batch-multiplier"
                type="number"
                step="0.05"
                min="0.1"
                className="input mt-1"
                placeholder="1.0"
                value={config.priceMultiplier}
                onChange={(e) =>
                  patch({ priceMultiplier: parseFloat(e.target.value) || 1.0 })
                }
              />
              <p className="text-[10px] text-muted mt-1">1.0 = no change, 1.1 = 10% up</p>
            </div>
          )}

          <div>
            <label className="label" htmlFor="batch-rounding">Price Rounding</label>
            <select
              id="batch-rounding"
              className="input mt-1"
              value={config.priceRounding || "end_99"}
              onChange={(e) => patch({ priceRounding: e.target.value })}
            >
              {(Object.entries(ROUNDING_LABELS) as [RoundingRule, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ── Advanced settings (collapsible) ── */}
      <button
        type="button"
        className="flex items-center gap-2 text-xs text-muted hover:text-white transition-colors mb-4"
        onClick={() => setShowAdvanced(!showAdvanced)}
      >
        <Settings2 className="w-3.5 h-3.5" />
        <span>Listing &amp; Platform Settings</span>
        {showAdvanced ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {showAdvanced && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-5 pl-4 border-l-2 border-border">
          {/* Listing Template */}
          <div>
            <label className="label" htmlFor="batch-template">Listing Template</label>
            <select
              id="batch-template"
              className="input mt-1"
              value={config.templateId || ""}
              onChange={(e) => patch({ templateId: e.target.value || undefined })}
            >
              <option value="">Auto-select</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>

          {/* Target Platform */}
          <div>
            <label className="label" htmlFor="batch-platform">Target Platform</label>
            <select
              id="batch-platform"
              className="input mt-1"
              value={config.platform || ""}
              onChange={(e) => patch({ platform: (e.target.value || undefined) as ExportPlatform | undefined })}
            >
              <option value="">None selected</option>
              {(Object.entries(PLATFORM_LABELS) as [ExportPlatform, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>

          {/* eBay Store Category */}
          <div>
            <label className="label" htmlFor="batch-ebay-cat">eBay Store Category</label>
            <input
              id="batch-ebay-cat"
              className="input mt-1"
              placeholder="Category name…"
              value={config.ebayCategoryName || ""}
              onChange={(e) => patch({ ebayCategoryName: e.target.value || undefined })}
            />
          </div>

          {/* eBay Category ID */}
          <div>
            <label className="label" htmlFor="batch-ebay-cat-id">eBay Category ID</label>
            <input
              id="batch-ebay-cat-id"
              className="input mt-1"
              placeholder="e.g. 183454"
              value={config.ebayCategoryId || ""}
              onChange={(e) => patch({ ebayCategoryId: e.target.value || undefined })}
            />
          </div>

          {/* Notes */}
          <div className="sm:col-span-2">
            <label className="label" htmlFor="batch-notes">Notes / Context</label>
            <textarea
              id="batch-notes"
              className="input mt-1 min-h-[60px] resize-y"
              placeholder="Extra info for vision analysis or listing descriptions…"
              value={config.notes || ""}
              onChange={(e) => patch({ notes: e.target.value || undefined })}
            />
          </div>
        </div>
      )}

      {/* ── Summary chips ── */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        <span className="chip">{GAME_LABELS[config.game]}</span>
        <span className="chip">{CARD_TYPE_LABELS[config.cardType]}</span>
        <span className="chip">{config.defaultCondition}</span>
        <span className="chip">{CARD_FINISH_LABELS[config.finish]}</span>
        <span className="chip">{config.imageMode === "front-and-back" ? "Front + Back" : "Front only"}</span>
        <span className="chip">{config.language}</span>
        {config.pricingStrategy && config.pricingStrategy !== "MATCH_MARKET" && (
          <span className="chip">{PRICING_STRATEGY_LABELS[config.pricingStrategy as PricingStrategy]}</span>
        )}
        {config.priceMultiplier !== 1.0 && (
          <span className="chip">{config.priceMultiplier}x</span>
        )}
        {config.floorPrice != null && config.floorPrice > 0 && (
          <span className="chip">Floor: ${config.floorPrice.toFixed(2)}</span>
        )}
        {config.priceRounding && config.priceRounding !== "none" && (
          <span className="chip">{ROUNDING_LABELS[config.priceRounding as RoundingRule]}</span>
        )}
        {config.platform && (
          <span className="chip">{PLATFORM_LABELS[config.platform]}</span>
        )}
      </div>

      {/* ── Start button ── */}
      <button type="submit" className="btn-primary w-full justify-center py-3 text-base">
        <Play className="w-5 h-5" />
        Start Scanning
      </button>
    </form>
  );
}
