"use client";

import { useEffect, useState } from "react";
import { v4 as uuid } from "uuid";
import {
  Plus,
  Trash2,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileSpreadsheet,
  Zap,
} from "lucide-react";
import type { Game, Condition, ScanProfile } from "@/lib/types";
import { GAME_LABELS, CONDITIONS } from "@/lib/types";
import {
  getAllProfiles,
  saveProfile,
  deleteProfile,
  getActiveProfileId,
  setActiveProfileId,
} from "@/lib/supabaseProfileStore";
import { useToast } from "@/components/Toast";

const FOIL_TYPES = ["None", "Holofoil", "Reverse Holo", "Full Art", "Alt Art", "Gold", "Rainbow", "Other"];
const PLATFORMS: { value: "ebay" | "tcgplayer" | "generic"; label: string }[] = [
  { value: "ebay", label: "eBay" },
  { value: "tcgplayer", label: "TCGPlayer" },
  { value: "generic", label: "Generic" },
];

export default function TemplatesPage() {
  const [profiles, setProfiles] = useState<ScanProfile[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const refresh = async () => {
    try {
      const p = await getAllProfiles();
      setProfiles(p);
      setActiveId(getActiveProfileId());
    } catch (err) {
      console.error("Failed to load profiles:", err);
      toast("error", "Failed to load profiles");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const handleCreate = async () => {
    const now = Date.now();
    const profile: ScanProfile = {
      id: uuid(),
      name: "New Profile",
      game: undefined,
      defaultCondition: "Near Mint",
      language: "English",
      platform: "ebay",
      titlePattern: "{name} {setName} {collectorNumber} {rarity} {condition} {foil} {gameFull}",
      descriptionPattern:
        "You are purchasing: {name} from {setName}.\n\nCondition: {condition}\nRarity: {rarity}\nLanguage: {language}\n{foil}\n\nShipped in a penny sleeve and top loader.",
      createdAt: now,
      updatedAt: now,
    };
    await saveProfile(profile);
    await refresh();
    setExpandedId(profile.id);
  };

  const handleDuplicate = async (p: ScanProfile) => {
    const now = Date.now();
    const clone: ScanProfile = {
      ...p,
      id: uuid(),
      name: `${p.name} (Copy)`,
      createdAt: now,
      updatedAt: now,
    };
    await saveProfile(clone);
    await refresh();
    setExpandedId(clone.id);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this profile?")) return;
    try {
      await deleteProfile(id);
      toast("success", "Profile deleted");
      await refresh();
    } catch {
      toast("error", "Failed to delete profile");
    }
  };

  const handleActivate = (id: string) => {
    const newActive = activeId === id ? null : id;
    setActiveProfileId(newActive);
    setActiveId(newActive);
  };

  const handleUpdate = async (id: string, patch: Partial<ScanProfile>) => {
    const p = profiles.find((x) => x.id === id);
    if (!p) return;
    const updated = { ...p, ...patch, updatedAt: Date.now() };
    // Optimistic UI update
    setProfiles((prev) => prev.map((x) => (x.id === id ? updated : x)));
    setSaved(id);
    setTimeout(() => setSaved(null), 1500);
    try {
      await saveProfile(updated);
    } catch (err) {
      console.error("Failed to save profile:", err);
      toast("error", "Failed to save profile changes");
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Templates</h1>
          <p className="text-sm text-muted mt-1">
            Scan presets and listing formats — pick one before scanning for better results
          </p>
        </div>
        <button onClick={handleCreate} className="btn-primary">
          <Plus className="w-4 h-4" />
          New Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="card-panel flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-5">
            <Sparkles className="w-8 h-8 text-accent" />
          </div>
          <h2 className="text-lg font-semibold mb-2">No profiles yet</h2>
          <p className="text-sm text-muted max-w-md mb-6">
            Create a profile to tell the scanner what TCG, set, and foil type to expect.
            This improves AI accuracy and pre-fills listing details for export.
          </p>
          <button onClick={handleCreate} className="btn-primary">
            <Plus className="w-4 h-4" />
            Create Your First Profile
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map((p) => {
            const isExpanded = expandedId === p.id;
            const isActive = activeId === p.id;

            return (
              <div
                key={p.id}
                className={`card-panel transition-colors ${
                  isActive ? "border-accent/40 bg-accent/[0.03]" : ""
                }`}
              >
                {/* Header row */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleActivate(p.id)}
                    className={`w-10 h-10 rounded-xl border flex items-center justify-center shrink-0 transition-colors ${
                      isActive
                        ? "bg-accent/15 border-accent/40 text-accent"
                        : "bg-panel2 border-border text-muted hover:border-accent/30"
                    }`}
                    title={isActive ? "Deactivate profile" : "Set as active profile"}
                  >
                    {isActive ? <Check className="w-5 h-5" /> : <Zap className="w-5 h-5" />}
                  </button>

                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => setExpandedId(isExpanded ? null : p.id)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-semibold truncate">{p.name}</span>
                      {isActive && (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border bg-accent/10 border-accent/30 text-accent">
                          Active
                        </span>
                      )}
                      {saved === p.id && (
                        <span className="text-xs text-accent2 inline-flex items-center gap-1">
                          <Check className="w-3 h-3" /> Saved
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
                      {p.game && <span className="chip text-[10px]">{GAME_LABELS[p.game]}</span>}
                      {p.setName && <span className="chip text-[10px]">{p.setName}</span>}
                      {p.foilType && p.foilType !== "None" && (
                        <span className="chip text-[10px]">{p.foilType}</span>
                      )}
                      {p.platform && <span className="chip text-[10px]">{p.platform}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDuplicate(p)}
                      className="p-2 rounded-lg text-muted hover:text-white hover:bg-panel2"
                      title="Duplicate"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(p.id)}
                      className="p-2 rounded-lg text-muted hover:text-danger hover:bg-danger/10"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : p.id)}
                      className="p-2 rounded-lg text-muted hover:text-white hover:bg-panel2"
                    >
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Expanded editor */}
                {isExpanded && (
                  <ProfileEditor
                    profile={p}
                    onUpdate={(patch) => handleUpdate(p.id, patch)}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Profile editor (inline, expanded) ──────────────────────

function ProfileEditor({
  profile: p,
  onUpdate,
}: {
  profile: ScanProfile;
  onUpdate: (patch: Partial<ScanProfile>) => void;
}) {
  return (
    <div className="mt-5 pt-5 border-t border-border space-y-6">
      {/* Basic info */}
      <div>
        <label className="label">Profile Name</label>
        <input
          className="input mt-1"
          value={p.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
        />
      </div>

      {/* ── Scan Hints ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Zap className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Scan Hints</h3>
          <span className="text-[10px] text-muted">(Helps AI identify cards more accurately)</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="label">TCG Game</label>
            <select
              className="input mt-1"
              value={p.game || ""}
              onChange={(e) => onUpdate({ game: (e.target.value || undefined) as Game | undefined })}
            >
              <option value="">Any / Auto-detect</option>
              {(Object.keys(GAME_LABELS) as Game[]).map((g) => (
                <option key={g} value={g}>{GAME_LABELS[g]}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Focus Set</label>
            <input
              className="input mt-1"
              placeholder="e.g. Surging Sparks"
              value={p.setName || ""}
              onChange={(e) => onUpdate({ setName: e.target.value || undefined })}
            />
          </div>

          <div>
            <label className="label">Set Code</label>
            <input
              className="input mt-1"
              placeholder="e.g. SSP, MH3, LOB"
              value={p.setCode || ""}
              onChange={(e) => onUpdate({ setCode: e.target.value || undefined })}
            />
          </div>

          <div>
            <label className="label">Expected Rarity</label>
            <input
              className="input mt-1"
              placeholder="e.g. Rare Holo, Common, Ultra Rare"
              value={p.rarity || ""}
              onChange={(e) => onUpdate({ rarity: e.target.value || undefined })}
            />
          </div>

          <div>
            <label className="label">Foil Type</label>
            <select
              className="input mt-1"
              value={p.foilType || ""}
              onChange={(e) => onUpdate({ foilType: e.target.value || undefined })}
            >
              <option value="">Not specified</option>
              {FOIL_TYPES.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Default Condition</label>
            <select
              className="input mt-1"
              value={p.defaultCondition || "Near Mint"}
              onChange={(e) => onUpdate({ defaultCondition: e.target.value as Condition })}
            >
              {CONDITIONS.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Language</label>
            <input
              className="input mt-1"
              placeholder="English"
              value={p.language || ""}
              onChange={(e) => onUpdate({ language: e.target.value || undefined })}
            />
          </div>

          <div>
            <label className="label">Exclude Sets</label>
            <input
              className="input mt-1"
              placeholder="Comma-separated codes or names"
              value={p.excludeSets?.join(", ") || ""}
              onChange={(e) =>
                onUpdate({
                  excludeSets: e.target.value
                    ? e.target.value.split(",").map((s) => s.trim()).filter(Boolean)
                    : undefined,
                })
              }
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="label">Extra Notes for AI</label>
          <textarea
            className="input mt-1 min-h-[70px]"
            placeholder="e.g. 'These are all Japanese promos from 2024' or 'Ignore any trainer gallery numbering'"
            value={p.notes || ""}
            onChange={(e) => onUpdate({ notes: e.target.value || undefined })}
          />
        </div>
      </div>

      {/* ── Listing Format ── */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <FileSpreadsheet className="w-4 h-4 text-accent" />
          <h3 className="font-semibold text-sm">Listing Format</h3>
          <span className="text-[10px] text-muted">(Controls exported title & description)</span>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <label className="label">Platform</label>
            <div className="flex gap-2 mt-1">
              {PLATFORMS.map((plat) => (
                <button
                  key={plat.value}
                  className={`btn flex-1 justify-center text-sm ${
                    p.platform === plat.value ? "border-accent/50 text-accent bg-accent/5" : ""
                  }`}
                  onClick={() => onUpdate({ platform: plat.value })}
                >
                  {plat.label}
                </button>
              ))}
            </div>
          </div>

          <div className="sm:col-span-2">
            <label className="label">Title Pattern</label>
            <input
              className="input mt-1 font-mono text-xs"
              value={p.titlePattern || ""}
              onChange={(e) => onUpdate({ titlePattern: e.target.value })}
            />
            <p className="text-[10px] text-muted mt-1">
              Variables: {"{name}"} {"{setName}"} {"{setCode}"} {"{collectorNumber}"} {"{rarity}"} {"{condition}"} {"{foil}"} {"{gameFull}"} {"{language}"} {"{price}"}
            </p>
          </div>

          <div className="sm:col-span-2">
            <label className="label">Description Pattern</label>
            <textarea
              className="input mt-1 min-h-[100px] font-mono text-xs"
              value={p.descriptionPattern || ""}
              onChange={(e) => onUpdate({ descriptionPattern: e.target.value })}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
