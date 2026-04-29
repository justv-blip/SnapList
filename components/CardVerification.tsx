"use client";

import { useState, useEffect, useCallback } from "react";
import type { ScannedCard, CardFinish } from "@/lib/types";
import type { SearchResult, VariantPrice } from "@/lib/tcgSearch";
import {
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  ImageIcon,
} from "lucide-react";

interface Props {
  card: ScannedCard;
  /** All cards in the batch — for prev/next navigation */
  cards: ScannedCard[];
  /** Index of this card in the cards array */
  currentIndex: number;
  onApply: (cardId: string, patch: Partial<ScannedCard>) => void;
  onNavigate: (index: number) => void;
  onClose: () => void;
}

export default function CardVerification({
  card,
  cards,
  currentIndex,
  onApply,
  onNavigate,
  onClose,
}: Props) {
  const [query, setQuery] = useState(card.name || "");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedFinish, setSelectedFinish] = useState<CardFinish | null>(null);

  // Get the best available image for this card (user photo preferred, then API image)
  const userPhoto =
    card.photos?.find((p) => p.role === "front")?.dataUrl ||
    card.uploadedImageDataUrl ||
    card.imageUrl;

  // Auto-search on open
  useEffect(() => {
    if (card.name) {
      runSearch(card.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  // Reset state when card changes
  useEffect(() => {
    setQuery(card.name || "");
    setSelectedId(null);
    setSelectedFinish(null);
    setSearched(false);
    setResults([]);
    if (card.name) {
      runSearch(card.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [card.id]);

  const runSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    setSearched(false);
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          game: card.game,
          query: searchQuery.trim(),
        }),
      });
      const data = await res.json();
      setResults(data.results || []);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
      setSearched(true);
    }
  }, [card.game]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  const handleApply = () => {
    if (!selectedId) return;
    const match = results.find((r) => r.id === selectedId);
    if (!match) return;

    const patch: Partial<ScannedCard> = {
      name: match.name,
      setName: match.setName,
      setCode: match.setCode,
      collectorNumber: match.collectorNumber,
      rarity: match.rarity,
      imageUrl: match.imageUrl,
      externalUrl: match.externalUrl,
      identificationSource: "verified",
      identificationConfidence: 100,
    };

    // Apply variant pricing if a finish was selected
    if (selectedFinish && match.variants.length > 0) {
      const variant = match.variants.find((v) => v.finish === selectedFinish);
      if (variant?.marketPrice != null) {
        patch.marketPriceUsd = variant.marketPrice;
      }
      patch.foil = selectedFinish !== "non-holo";
    } else if (match.marketPriceUsd != null) {
      patch.marketPriceUsd = match.marketPriceUsd;
    }

    onApply(card.id, patch);

    // Auto-advance to next card if available
    if (currentIndex < cards.length - 1) {
      onNavigate(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < cards.length - 1) onNavigate(currentIndex + 1);
    },
    [onClose, onNavigate, currentIndex, cards.length]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const rawConf = card.identificationConfidence ?? 0;
  // Confidence may be 0-1 or 0-100 depending on source; normalize to 0-100
  const confidencePct = rawConf <= 1 ? Math.round(rawConf * 100) : Math.round(rawConf);
  const confidenceColor =
    confidencePct >= 80
      ? "text-accent2"
      : confidencePct >= 50
        ? "text-amber-400"
        : "text-danger";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-panel border border-border rounded-2xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-accent" />
            <h2 className="font-semibold text-lg">Verify Card</h2>
            <span className="text-sm text-muted">
              {currentIndex + 1} of {cards.length}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn text-xs"
              disabled={currentIndex === 0}
              onClick={() => onNavigate(currentIndex - 1)}
              title="Previous card (←)"
            >
              <ChevronLeft className="w-4 h-4" />
              Prev
            </button>
            <button
              className="btn text-xs"
              disabled={currentIndex === cards.length - 1}
              onClick={() => onNavigate(currentIndex + 1)}
              title="Next card (→)"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              className="text-muted hover:text-white transition-colors ml-2"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: User's photo */}
            <div>
              <p className="text-xs text-muted uppercase tracking-wider font-medium mb-2">
                Your Scan
              </p>
              <div className="aspect-[2.5/3.5] rounded-xl overflow-hidden bg-panel2 border border-border">
                {userPhoto ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={userPhoto}
                    alt="Scanned card"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted gap-2">
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-xs">No photo available</span>
                  </div>
                )}
              </div>
              <div className="mt-3 space-y-1">
                <p className="text-sm font-medium">{card.name || "Unknown card"}</p>
                {card.setName && (
                  <p className="text-xs text-muted">{card.setName}</p>
                )}
                <div className="flex items-center gap-2 text-xs">
                  <span className={confidenceColor}>
                    {confidencePct}% confidence
                  </span>
                  {card.identificationSource && (
                    <span className="text-muted">via {card.identificationSource}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Right: Search + results */}
            <div>
              <p className="text-xs text-muted uppercase tracking-wider font-medium mb-2">
                Find Correct Match
              </p>

              {/* Search bar */}
              <form onSubmit={handleSearch} className="flex gap-2 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search card name..."
                    className="w-full pl-9 pr-3 py-2 bg-panel2 border border-border rounded-lg text-sm focus:outline-none focus:border-accent"
                  />
                </div>
                <button
                  type="submit"
                  className="btn-primary text-xs px-4"
                  disabled={searching || !query.trim()}
                >
                  {searching ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    "Search"
                  )}
                </button>
              </form>

              {/* Results list */}
              <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
                {searching && (
                  <div className="flex items-center justify-center py-8 text-muted gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-sm">Searching...</span>
                  </div>
                )}

                {!searching && searched && results.length === 0 && (
                  <div className="text-center py-8 text-muted">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No results found</p>
                    <p className="text-xs mt-1">Try a different search term</p>
                  </div>
                )}

                {!searching &&
                  results.map((result) => (
                    <ResultCard
                      key={result.id}
                      result={result}
                      selected={selectedId === result.id}
                      selectedFinish={selectedId === result.id ? selectedFinish : null}
                      onSelect={() => {
                        setSelectedId(result.id);
                        // Auto-select the first variant finish
                        if (result.variants.length > 0) {
                          setSelectedFinish(result.variants[0].finish);
                        } else {
                          setSelectedFinish(null);
                        }
                      }}
                      onSelectFinish={(finish) => {
                        setSelectedId(result.id);
                        setSelectedFinish(finish);
                      }}
                    />
                  ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border flex items-center justify-between">
          <div className="text-xs text-muted">
            {selectedId ? (
              <span className="text-accent2 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Card selected — click Apply to confirm
              </span>
            ) : (
              "Select a card from the results to apply"
            )}
          </div>
          <div className="flex gap-3">
            <button className="btn" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn-primary"
              disabled={!selectedId}
              onClick={handleApply}
            >
              <CheckCircle2 className="w-4 h-4" />
              Apply Match
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---- Result card with variant buttons ----

function ResultCard({
  result,
  selected,
  selectedFinish,
  onSelect,
  onSelectFinish,
}: {
  result: SearchResult;
  selected: boolean;
  selectedFinish: CardFinish | null;
  onSelect: () => void;
  onSelectFinish: (finish: CardFinish) => void;
}) {
  const activeVariant = selectedFinish
    ? result.variants.find((v) => v.finish === selectedFinish)
    : result.variants[0];

  return (
    <div
      className={`rounded-xl border p-3 cursor-pointer transition-all ${
        selected
          ? "border-accent bg-accent/5 ring-1 ring-accent/30"
          : "border-border bg-panel2 hover:border-accent/40"
      }`}
      onClick={onSelect}
    >
      <div className="flex gap-3">
        {/* Thumbnail */}
        <div className="shrink-0 w-16">
          <div className="aspect-[2.5/3.5] rounded-lg overflow-hidden bg-panel border border-border">
            {result.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={result.imageUrl}
                alt={result.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted">
                <ImageIcon className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{result.name}</p>
          <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
            {result.setName && <span className="truncate">{result.setName}</span>}
            {result.collectorNumber && (
              <span className="shrink-0">#{result.collectorNumber}</span>
            )}
          </div>
          {result.rarity && (
            <p className="text-[11px] text-muted mt-0.5 capitalize">{result.rarity}</p>
          )}

          {/* Variant / finish buttons */}
          {result.variants.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {result.variants.map((variant) => (
                <VariantButton
                  key={variant.finish + variant.label}
                  variant={variant}
                  active={selected && selectedFinish === variant.finish}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectFinish(variant.finish);
                  }}
                />
              ))}
            </div>
          )}

          {/* Price display */}
          {activeVariant?.marketPrice != null && selected && (
            <p className="text-xs text-accent2 mt-1.5 font-medium">
              Market: ${activeVariant.marketPrice.toFixed(2)}
            </p>
          )}
          {!selected && result.marketPriceUsd != null && (
            <p className="text-xs text-muted mt-1.5">
              From ${result.marketPriceUsd.toFixed(2)}
            </p>
          )}
        </div>

        {/* Selected indicator */}
        {selected && (
          <div className="shrink-0 flex items-start">
            <CheckCircle2 className="w-5 h-5 text-accent" />
          </div>
        )}
      </div>

      {/* External link */}
      {result.externalUrl && selected && (
        <a
          href={result.externalUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline mt-2 ml-19"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink className="w-3 h-3" />
          View on source
        </a>
      )}
    </div>
  );
}

// ---- Variant button ----

function VariantButton({
  variant,
  active,
  onClick,
}: {
  variant: VariantPrice;
  active: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  return (
    <button
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-all ${
        active
          ? "bg-accent text-white shadow-sm"
          : "bg-panel border border-border text-muted hover:text-white hover:border-accent/40"
      }`}
      onClick={onClick}
    >
      <FinishDot finish={variant.finish} />
      {variant.label}
      {variant.marketPrice != null && (
        <span className={active ? "text-white/80" : "text-muted"}>
          ${variant.marketPrice.toFixed(2)}
        </span>
      )}
    </button>
  );
}

// ---- Finish dot color indicator ----

function FinishDot({ finish }: { finish: CardFinish }) {
  const colors: Record<CardFinish, string> = {
    "non-holo": "bg-gray-400",
    holo: "bg-yellow-400",
    "reverse-holo": "bg-purple-400",
    "full-art": "bg-blue-400",
    etched: "bg-cyan-400",
    gold: "bg-amber-500",
    textured: "bg-pink-400",
    any: "bg-gray-400",
  };
  return (
    <span className={`w-2 h-2 rounded-full ${colors[finish] || "bg-gray-400"}`} />
  );
}
