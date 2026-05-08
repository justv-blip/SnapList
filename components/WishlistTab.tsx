"use client";

import { useEffect, useRef, useState } from "react";
import {
  Heart,
  Plus,
  Trash2,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  Loader2,
  DollarSign,
  Search,
  Bell,
  BellOff,
  Check,
  X,
} from "lucide-react";
import { GAME_LABELS, GAMES, type Game } from "@/lib/types";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WishlistItem {
  id: string;
  name: string;
  game: string;
  set_name: string | null;
  max_price_usd: number | null;
  alert_price_usd: number | null;
  alert_enabled: boolean;
  alert_sent_at: string | null;
  notes: string | null;
  found: boolean;
  found_at: string | null;
  created_at: string;
}

// ─── Add form ─────────────────────────────────────────────────────────────────

function AddForm({ onAdded }: { onAdded: (item: WishlistItem) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [game, setGame] = useState<Game>("pokemon");
  const [setNameInput, setSetNameInput] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setName(""); setGame("pokemon"); setSetNameInput("");
    setMaxPrice(""); setNotes(""); setError(null);
  };

  const handleAdd = async () => {
    if (!name.trim()) { setError("Card name is required."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/wishlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          game,
          set_name: setNameInput.trim() || null,
          max_price_usd: maxPrice ? parseFloat(maxPrice) : null,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add item."); return; }
      onAdded(data.item);
      reset();
      setOpen(false);
    } catch {
      setError("Network error — please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card-panel">
      <button
        className="flex items-center gap-2 w-full text-left px-4 py-3 text-sm font-medium"
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => nameRef.current?.focus(), 50);
        }}
      >
        <Plus className="w-4 h-4 text-accent" />
        Add to wishlist
        {open ? (
          <ChevronUp className="w-4 h-4 text-muted ml-auto" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted ml-auto" />
        )}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-border pt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Card / Product Name *</label>
              <input
                ref={nameRef}
                className="input mt-1"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder="e.g. Charizard Holo, Pikachu VMAX Alt Art"
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
                  <option key={g} value={g}>{GAME_LABELS[g]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Set Name</label>
              <input
                className="input mt-1"
                value={setNameInput}
                onChange={(e) => setSetNameInput(e.target.value)}
                placeholder="e.g. Base Set, Scarlet & Violet"
              />
            </div>

            <div>
              <label className="label">Max Price (USD)</label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                <input
                  type="number"
                  className="input pl-8"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            <div>
              <label className="label">Notes</label>
              <input
                className="input mt-1"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. PSA 10 only, 1st edition"
              />
            </div>
          </div>

          {error && <p className="text-sm text-danger mt-2">{error}</p>}

          <div className="flex gap-2 mt-4">
            <button
              className="btn-primary flex items-center gap-2"
              onClick={handleAdd}
              disabled={saving || !name.trim()}
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Heart className="w-4 h-4" />}
              {saving ? "Adding…" : "Add to wishlist"}
            </button>
            <button
              className="btn"
              onClick={() => { reset(); setOpen(false); }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────

function WishlistRow({
  item,
  onToggleFound,
  onDelete,
  onUpdate,
}: {
  item: WishlistItem;
  onToggleFound: (id: string, found: boolean) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, patch: Partial<WishlistItem>) => void;
}) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertInput, setAlertInput] = useState(item.alert_price_usd?.toFixed(2) ?? "");
  const [savingAlert, setSavingAlert] = useState(false);

  const handleToggle = async () => {
    setToggling(true);
    try {
      await fetch(`/api/wishlist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ found: !item.found }),
      });
      onToggleFound(item.id, !item.found);
    } finally {
      setToggling(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/wishlist/${item.id}`, { method: "DELETE" });
      onDelete(item.id);
    } finally {
      setDeleting(false);
    }
  };

  const saveAlert = async () => {
    setSavingAlert(true);
    const price = parseFloat(alertInput);
    const isValid = !isNaN(price) && price > 0;
    const patch = {
      alert_price_usd: isValid ? price : null,
      alert_enabled: isValid,
    };
    try {
      await fetch(`/api/wishlist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      onUpdate(item.id, patch);
      setAlertOpen(false);
    } finally {
      setSavingAlert(false);
    }
  };

  const removeAlert = async () => {
    setSavingAlert(true);
    try {
      await fetch(`/api/wishlist/${item.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert_price_usd: null, alert_enabled: false }),
      });
      onUpdate(item.id, { alert_price_usd: null, alert_enabled: false });
      setAlertInput("");
      setAlertOpen(false);
    } finally {
      setSavingAlert(false);
    }
  };

  const gameLabel = GAME_LABELS[item.game as Game] ?? item.game;
  const hasAlert = item.alert_enabled && item.alert_price_usd != null;

  return (
    <div
      className={`card-panel px-4 py-3 transition-opacity ${
        item.found ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Found toggle */}
        <button
          className="shrink-0"
          onClick={handleToggle}
          disabled={toggling}
          title={item.found ? "Mark as still wanted" : "Mark as found"}
        >
          {toggling ? (
            <Loader2 className="w-5 h-5 animate-spin text-muted" />
          ) : item.found ? (
            <CheckCircle2 className="w-5 h-5 text-green-400" />
          ) : (
            <Circle className="w-5 h-5 text-muted hover:text-accent transition-colors" />
          )}
        </button>

        {/* Details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-sm font-medium ${item.found ? "line-through text-muted" : ""}`}>
              {item.name}
            </span>
            <span className="chip text-[10px]">{gameLabel}</span>
            {item.set_name && <span className="chip text-[10px]">{item.set_name}</span>}
            {item.found && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400">
                <CheckCircle2 className="w-3 h-3" /> Found
              </span>
            )}
            {hasAlert && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400">
                <Bell className="w-3 h-3" />
                Alert ≤${item.alert_price_usd!.toFixed(0)}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            {item.max_price_usd != null && (
              <span className="text-xs text-muted">
                Max: ${item.max_price_usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            )}
            {item.notes && <span className="text-xs text-muted truncate">{item.notes}</span>}
            {item.alert_sent_at && (
              <span className="text-xs text-amber-400/70">
                Last alerted {new Date(item.alert_sent_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>

        {/* Alert toggle button */}
        {!item.found && (
          <button
            className={`btn shrink-0 text-xs ${hasAlert ? "border-amber-500/40 text-amber-400 hover:bg-amber-500/10" : ""}`}
            onClick={() => { setAlertOpen((v) => !v); setAlertInput(item.alert_price_usd?.toFixed(2) ?? ""); }}
            title={hasAlert ? "Edit price alert" : "Set price alert"}
          >
            {hasAlert
              ? <Bell className="w-3.5 h-3.5" />
              : <BellOff className="w-3.5 h-3.5" />}
          </button>
        )}

        {/* eBay search */}
        <a
          href={`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(
            `${gameLabel} ${item.name}${item.set_name ? " " + item.set_name : ""}`
          )}&LH_Sold=1&LH_Complete=1`}
          target="_blank"
          rel="noreferrer"
          className="btn shrink-0 text-xs"
          title="Search eBay sold listings"
        >
          <Search className="w-3.5 h-3.5" />
          eBay
        </a>

        {/* Delete */}
        <button className="btn-danger shrink-0" onClick={handleDelete} disabled={deleting}>
          {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
        </button>
      </div>

      {/* Inline alert editor */}
      {alertOpen && (
        <div className="mt-3 pt-3 border-t border-border flex items-center gap-3 flex-wrap">
          <Bell className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="text-xs text-muted">Email me when price drops to</span>
          <div className="relative">
            <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
            <input
              type="number"
              className="input pl-7 w-28 text-sm py-1.5"
              value={alertInput}
              onChange={(e) => setAlertInput(e.target.value)}
              placeholder="0.00"
              min="0"
              step="0.01"
              onKeyDown={(e) => e.key === "Enter" && saveAlert()}
              autoFocus
            />
          </div>
          <span className="text-xs text-muted">or lower</span>
          <div className="flex gap-1.5 ml-auto">
            {hasAlert && (
              <button
                className="btn text-xs text-danger border-danger/30 hover:bg-danger/10"
                onClick={removeAlert}
                disabled={savingAlert}
              >
                <X className="w-3.5 h-3.5" /> Remove
              </button>
            )}
            <button
              className="btn-primary text-xs flex items-center gap-1.5"
              onClick={saveAlert}
              disabled={savingAlert || !alertInput}
            >
              {savingAlert ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save
            </button>
            <button className="btn text-xs" onClick={() => setAlertOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main tab ─────────────────────────────────────────────────────────────────

export default function WishlistTab() {
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "wanted" | "found">("wanted");

  useEffect(() => {
    fetch("/api/wishlist")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleAdded = (item: WishlistItem) =>
    setItems((prev) => [item, ...prev]);

  const handleToggleFound = (id: string, found: boolean) =>
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, found, found_at: found ? new Date().toISOString() : null } : it
      )
    );

  const handleDelete = (id: string) =>
    setItems((prev) => prev.filter((it) => it.id !== id));

  const handleUpdate = (id: string, patch: Partial<WishlistItem>) =>
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } : it));

  const filtered =
    filter === "all"
      ? items
      : filter === "wanted"
      ? items.filter((i) => !i.found)
      : items.filter((i) => i.found);

  const wantedCount = items.filter((i) => !i.found).length;
  const foundCount  = items.filter((i) => i.found).length;

  return (
    <div className="space-y-4">
      {/* Stats + filter */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>
            <span className="font-semibold text-foreground">{wantedCount}</span> wanted
          </span>
          <span>
            <span className="font-semibold text-green-400">{foundCount}</span> found
          </span>
        </div>

        <div className="flex gap-1 p-0.5 rounded-lg bg-panel2 border border-border">
          {(["wanted", "all", "found"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                filter === f
                  ? "bg-accent text-black"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Add form */}
      <AddForm onAdded={handleAdded} />

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-10">
          <Loader2 className="w-6 h-6 animate-spin text-muted" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Heart className="w-8 h-8 text-muted/40 mb-3" />
          <p className="text-sm font-medium text-muted">
            {filter === "found"
              ? "No found items yet"
              : filter === "wanted"
              ? "Your wishlist is empty"
              : "No items yet"}
          </p>
          <p className="text-xs text-muted/60 mt-1">
            {filter === "wanted" &&
              "Add cards you're hunting for — mark them found when you score one."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <WishlistRow
              key={item.id}
              item={item}
              onToggleFound={handleToggleFound}
              onDelete={handleDelete}
              onUpdate={handleUpdate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
