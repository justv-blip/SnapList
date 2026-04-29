// Supabase-backed persistence layer for scan profiles.
// Replaces the localStorage profileStore with real database persistence.

import type { ScanProfile, Condition } from "./types";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Map a database row into a ScanProfile. */
function dbRowToProfile(row: Record<string, unknown>): ScanProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    game: (row.game as ScanProfile["game"]) || undefined,
    setName: (row.set_name as string) || undefined,
    setCode: (row.set_code as string) || undefined,
    rarity: (row.rarity as string) || undefined,
    foilType: (row.foil_type as string) || undefined,
    excludeSets: (row.exclude_sets as string[]) || undefined,
    defaultCondition: (row.default_condition as Condition) || undefined,
    language: (row.language as string) || undefined,
    notes: (row.notes as string) || undefined,
    titlePattern: (row.title_pattern as string) || undefined,
    descriptionPattern: (row.description_pattern as string) || undefined,
    platform: (row.platform as ScanProfile["platform"]) || undefined,
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date(row.updated_at as string).getTime(),
  };
}

/** Convert a ScanProfile into a database row shape (snake_case). */
function profileToDbRow(
  profile: ScanProfile,
  userId: string
): Record<string, unknown> {
  return {
    id: profile.id,
    user_id: userId,
    name: profile.name,
    game: profile.game || null,
    set_name: profile.setName || null,
    set_code: profile.setCode || null,
    rarity: profile.rarity || null,
    foil_type: profile.foilType || null,
    exclude_sets: profile.excludeSets || null,
    default_condition: profile.defaultCondition || null,
    language: profile.language || null,
    notes: profile.notes || null,
    title_pattern: profile.titlePattern || null,
    description_pattern: profile.descriptionPattern || null,
    platform: profile.platform || "ebay",
    updated_at: new Date().toISOString(),
  };
}

async function getUserId(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  return user.id;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function getAllProfiles(): Promise<ScanProfile[]> {
  const supabase = createClient();
  const userId = await getUserId();

  const { data, error } = await supabase
    .from("scan_profiles")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map((r) => dbRowToProfile(r as Record<string, unknown>));
}

export async function getProfile(id: string): Promise<ScanProfile | undefined> {
  const supabase = createClient();

  const { data, error } = await supabase
    .from("scan_profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return undefined;
  return dbRowToProfile(data as Record<string, unknown>);
}

export async function saveProfile(profile: ScanProfile): Promise<void> {
  const supabase = createClient();
  const userId = await getUserId();

  const { error } = await supabase
    .from("scan_profiles")
    .upsert(profileToDbRow(profile, userId));

  if (error) throw error;
}

export async function deleteProfile(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("scan_profiles")
    .delete()
    .eq("id", id);

  if (error) throw error;

  // Clear active if it was this one
  const activeId = getActiveProfileId();
  if (activeId === id) setActiveProfileId(null);
}

// Active profile is stored in localStorage (it's a UI preference, not data)
const ACTIVE_KEY = "tcg-scanner-active-profile";

export function getActiveProfileId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function setActiveProfileId(id: string | null): void {
  if (typeof window === "undefined") return;
  if (id) {
    localStorage.setItem(ACTIVE_KEY, id);
  } else {
    localStorage.removeItem(ACTIVE_KEY);
  }
}

export async function getActiveProfile(): Promise<ScanProfile | undefined> {
  const id = getActiveProfileId();
  return id ? getProfile(id) : undefined;
}
