"use client";

import { useCallback, useMemo, useState } from "react";
import { v4 as uuid } from "uuid";
import type { ListingTemplate, ScannedCard } from "@/lib/types";
import { TEMPLATE_VARIABLES } from "@/lib/types";
import {
  DEFAULT_TEMPLATES,
  resolveTemplate,
  findBestTemplate,
  generateListingTitle,
  generateListingDescription,
  createBlankTemplate,
} from "@/lib/templates";
import {
  FileText,
  Copy,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Eye,
  Tag,
} from "lucide-react";

interface Props {
  cards: ScannedCard[];
  templates: ListingTemplate[];
  onTemplatesChange: (templates: ListingTemplate[]) => void;
}

export default function ListingEditor({ cards, templates, onTemplatesChange }: Props) {
  const [selectedPlatform, setSelectedPlatform] = useState<"ebay" | "tcgplayer" | "generic">("ebay");
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);

  const platformTemplates = useMemo(
    () => templates.filter((t) => t.platform === selectedPlatform),
    [templates, selectedPlatform]
  );

  const editingTemplate = editingTemplateId
    ? templates.find((t) => t.id === editingTemplateId)
    : null;

  const updateTemplate = useCallback(
    (id: string, patch: Partial<ListingTemplate>) => {
      onTemplatesChange(
        templates.map((t) => (t.id === id ? { ...t, ...patch } : t))
      );
    },
    [templates, onTemplatesChange]
  );

  const addTemplate = useCallback(() => {
    const t = createBlankTemplate(selectedPlatform);
    onTemplatesChange([...templates, t]);
    setEditingTemplateId(t.id);
  }, [templates, onTemplatesChange, selectedPlatform]);

  const deleteTemplate = useCallback(
    (id: string) => {
      // Don't allow deleting built-in templates
      const t = templates.find((t) => t.id === id);
      if (t && DEFAULT_TEMPLATES.some((d) => d.id === id)) return;
      onTemplatesChange(templates.filter((t) => t.id !== id));
      if (editingTemplateId === id) setEditingTemplateId(null);
    },
    [templates, onTemplatesChange, editingTemplateId]
  );

  // Preview card: use the first card with data, or a sample
  const previewCard = cards.find((c) => c.name) || cards[0];

  return (
    <div className="card-panel">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FileText className="w-5 h-5 text-accent" />
          <h3 className="font-semibold">Listing Templates</h3>
        </div>
        <div className="flex items-center gap-1 p-1 bg-panel2 rounded-lg">
          {(["ebay", "tcgplayer", "generic"] as const).map((p) => (
            <button
              key={p}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                selectedPlatform === p
                  ? "bg-panel border border-border text-white shadow-sm"
                  : "text-muted hover:text-white"
              }`}
              onClick={() => setSelectedPlatform(p)}
            >
              {p === "ebay" ? "eBay" : p === "tcgplayer" ? "TCGPlayer" : "Generic"}
            </button>
          ))}
        </div>
      </div>

      {/* Template list */}
      <div className="space-y-2 mb-4">
        {platformTemplates.map((t) => {
          const isBuiltIn = DEFAULT_TEMPLATES.some((d) => d.id === t.id);
          const isEditing = editingTemplateId === t.id;
          return (
            <div
              key={t.id}
              className={`border rounded-lg p-3 transition-colors ${
                isEditing ? "border-accent/50 bg-accent/5" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <button
                  className="flex items-center gap-2 text-sm font-medium hover:text-accent"
                  onClick={() => setEditingTemplateId(isEditing ? null : t.id)}
                >
                  <Tag className="w-3.5 h-3.5 text-muted" />
                  {t.name}
                  {t.game && <span className="chip text-[10px]">{t.game}</span>}
                  {isEditing ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
                {!isBuiltIn && (
                  <button
                    className="text-muted hover:text-danger"
                    onClick={() => deleteTemplate(t.id)}
                    title="Delete template"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {isEditing && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="label">Template name</label>
                    <input
                      className="input mt-1"
                      value={t.name}
                      onChange={(e) => updateTemplate(t.id, { name: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Title pattern</label>
                    <input
                      className="input mt-1 font-mono text-xs"
                      value={t.titlePattern}
                      onChange={(e) => updateTemplate(t.id, { titlePattern: e.target.value })}
                    />
                  </div>
                  <div>
                    <label className="label">Description pattern</label>
                    <textarea
                      className="input mt-1 font-mono text-xs min-h-[100px]"
                      value={t.descriptionPattern}
                      onChange={(e) => updateTemplate(t.id, { descriptionPattern: e.target.value })}
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-muted uppercase tracking-wider mr-1">Variables:</span>
                    {TEMPLATE_VARIABLES.map((v) => (
                      <button
                        key={v}
                        className="chip hover:border-accent/50 hover:text-accent cursor-pointer"
                        onClick={() => {
                          navigator.clipboard.writeText(`{${v}}`);
                        }}
                        title={`Click to copy {${v}}`}
                      >
                        {`{${v}}`}
                      </button>
                    ))}
                  </div>

                  {/* Live preview */}
                  {previewCard && (
                    <div className="mt-2 p-3 bg-panel2 rounded-lg border border-border">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Eye className="w-3.5 h-3.5 text-accent" />
                        <span className="text-[10px] text-muted uppercase tracking-wider">
                          Preview ({previewCard.name || "no card"})
                        </span>
                      </div>
                      <div className="text-sm font-medium mb-1">
                        {resolveTemplate(t.titlePattern, previewCard)}
                      </div>
                      <div className="text-xs text-muted whitespace-pre-wrap">
                        {resolveTemplate(t.descriptionPattern, previewCard)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add template button */}
      <button className="btn w-full justify-center" onClick={addTemplate}>
        <Plus className="w-4 h-4" />
        New {selectedPlatform === "ebay" ? "eBay" : selectedPlatform === "tcgplayer" ? "TCGPlayer" : "Generic"} template
      </button>

      {/* Bulk preview: show what all cards will look like */}
      {cards.length > 0 && (
        <div className="mt-5">
          <button
            className="flex items-center gap-1.5 text-xs text-muted hover:text-white mb-3"
            onClick={() => setShowPreview((v) => !v)}
          >
            {showPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            Preview all {cards.length} listing{cards.length !== 1 ? "s" : ""}
          </button>

          {showPreview && (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {cards.map((card) => {
                const title = generateListingTitle(card, templates, selectedPlatform);
                const photoCount = (card.photos || []).length;
                return (
                  <div
                    key={card.id}
                    className="flex items-center gap-3 p-2 bg-panel2 rounded-lg border border-border"
                  >
                    <div className="w-8 h-11 rounded overflow-hidden bg-panel border border-border shrink-0">
                      {(card.imageUrl || card.uploadedImageDataUrl) && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={card.imageUrl || card.uploadedImageDataUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{title}</div>
                      <div className="text-[11px] text-muted">
                        {photoCount} photo{photoCount !== 1 ? "s" : ""} · {card.condition}
                        {card.marketPriceUsd ? ` · $${card.marketPriceUsd.toFixed(2)}` : ""}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
