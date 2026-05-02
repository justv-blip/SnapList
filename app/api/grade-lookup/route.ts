// Grade verification API — looks up cert numbers against grading company databases.
// Supports PSA, BGS (Beckett), CGC, SGC, TAG, and ARS.
//
// POST /api/grade-lookup
// Body: { company: GradingCompany, certNumber: string }
// Returns: { verified: boolean, grade?: string, label?: string, population?: number, subgrades?: Record<string, string>, error?: string }

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, authErrorResponse } from "@/lib/supabase/api-auth";
import { sanitizeString, isValidGradingCompany } from "@/lib/validation";
import type { GradingCompany } from "@/lib/types";

interface GradeLookupResult {
  verified: boolean;
  grade?: string;
  label?: string;
  population?: number;
  subgrades?: Record<string, string>;
  cardName?: string;
  year?: string;
  setName?: string;
  error?: string;
}

// ── PSA ──────────────────────────────────────────────────────────────────────
// Uses PSA's public certification API (no key required).
async function lookupPSA(certNumber: string): Promise<GradeLookupResult> {
  try {
    const res = await fetch(
      `https://api.psacard.com/publicapi/cert/GetByCertNumber/${encodeURIComponent(certNumber)}`,
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "SnapList/1.0",
        },
        // 8-second timeout via AbortController
        signal: AbortSignal.timeout(8000),
      }
    );

    if (res.status === 404) return { verified: false, error: "PSA cert number not found." };
    if (!res.ok) return { verified: false, error: `PSA returned status ${res.status}.` };

    const data = await res.json();
    // PSA public API wraps results in a PSACert object
    const cert = data?.PSACert ?? data;

    if (!cert) return { verified: false, error: "Unexpected PSA response format." };

    const grade = cert.CardGrade ?? cert.grade ?? cert.Grade;
    const cardName = [cert.Subject, cert.Spec, cert.CardNumber]
      .filter(Boolean)
      .join(" — ") || cert.cardName || cert.description;
    const year = cert.Year ?? cert.year;
    const population = cert.PopulationHigher != null
      ? Number(cert.PopulationHigher) + 1   // PSA reports "pop higher" not total
      : cert.population != null ? Number(cert.population) : undefined;
    const label = cert.LabelType ?? cert.label;

    if (grade) {
      return { verified: true, grade: String(grade), cardName, year, population, label };
    }
    return { verified: false, error: "Could not extract grade from PSA response." };
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      return { verified: false, error: "PSA verification timed out. Try again." };
    }
    return { verified: false, error: "Failed to reach PSA verification service." };
  }
}

// ── BGS (Beckett) ─────────────────────────────────────────────────────────────
// Beckett has no official public API — we use their cert page as a fallback.
async function lookupBGS(certNumber: string): Promise<GradeLookupResult> {
  try {
    const res = await fetch(
      `https://www.beckett.com/grading/card-lookup?serial_number=${encodeURIComponent(certNumber)}`,
      {
        headers: { "User-Agent": "SnapList/1.0", Accept: "text/html" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return { verified: false, error: "BGS cert not found." };

    const html = await res.text();

    const gradeMatch =
      html.match(/Final\s*Grade[^<]*<[^>]+>\s*([^<]+)/i) ||
      html.match(/"overall_grade"\s*:\s*"?([^",}\s]+)/i);
    const grade = gradeMatch?.[1]?.trim();

    const subgrades: Record<string, string> = {};
    const subMatches = html.matchAll(/(Centering|Corners|Edges|Surface)[^<]*<[^>]+>\s*([^<]+)/gi);
    for (const m of subMatches) {
      const val = m[2].trim();
      if (val && /[\d.]/.test(val)) subgrades[m[1].toLowerCase()] = val;
    }

    if (grade) {
      return {
        verified: true,
        grade,
        subgrades: Object.keys(subgrades).length > 0 ? subgrades : undefined,
      };
    }
    return {
      verified: false,
      error: "Could not extract grade from Beckett page. The page layout may have changed.",
    };
  } catch (err: any) {
    if (err?.name === "TimeoutError") return { verified: false, error: "BGS verification timed out." };
    return { verified: false, error: "Failed to reach BGS verification service." };
  }
}

// ── CGC ───────────────────────────────────────────────────────────────────────
// CGC has a public JSON cert lookup endpoint.
async function lookupCGC(certNumber: string): Promise<GradeLookupResult> {
  try {
    // Try JSON API first
    const jsonRes = await fetch(
      `https://www.cgccards.com/certlookup/${encodeURIComponent(certNumber)}/`,
      {
        headers: { "User-Agent": "SnapList/1.0", Accept: "application/json, text/html" },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!jsonRes.ok) return { verified: false, error: "CGC cert not found." };

    const contentType = jsonRes.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const data = await jsonRes.json();
      const grade =
        data?.grade ?? data?.overallGrade ?? data?.certInfo?.grade ?? data?.certInfo?.overallGrade;
      const cardName = data?.title ?? data?.certInfo?.title ?? data?.name;
      if (grade) return { verified: true, grade: String(grade), cardName };
      return { verified: false, error: "Unexpected CGC JSON format." };
    }

    // Fall back to HTML parsing
    const html = await jsonRes.text();
    const gradeMatch =
      html.match(/class="[^"]*grade[^"]*"[^>]*>\s*([^<]+)/i) ||
      html.match(/Grade[^<]*<[^>]+>\s*([^<]+)/i);
    const grade = gradeMatch?.[1]?.trim();
    if (grade && /[\d.]/.test(grade)) return { verified: true, grade };

    return { verified: false, error: "Could not extract grade from CGC page." };
  } catch (err: any) {
    if (err?.name === "TimeoutError") return { verified: false, error: "CGC verification timed out." };
    return { verified: false, error: "Failed to reach CGC verification service." };
  }
}

// ── SGC ───────────────────────────────────────────────────────────────────────
async function lookupSGC(certNumber: string): Promise<GradeLookupResult> {
  try {
    const res = await fetch(
      `https://www.gosgc.com/card-certification-verification?cert=${encodeURIComponent(certNumber)}`,
      {
        headers: { "User-Agent": "SnapList/1.0", Accept: "text/html" },
        signal: AbortSignal.timeout(8000),
      }
    );
    if (!res.ok) return { verified: false, error: "SGC cert not found." };

    const html = await res.text();
    const gradeMatch =
      html.match(/class="[^"]*grade[^"]*"[^>]*>\s*([^<]+)/i) ||
      html.match(/Grade[^<]*<[^>]+>\s*([^<]+)/i) ||
      html.match(/"grade"\s*:\s*"?([^",}\s]+)/i);
    const grade = gradeMatch?.[1]?.trim();

    if (grade && /[\d.]/.test(grade)) return { verified: true, grade };
    return { verified: false, error: "Could not extract grade from SGC page." };
  } catch (err: any) {
    if (err?.name === "TimeoutError") return { verified: false, error: "SGC verification timed out." };
    return { verified: false, error: "Failed to reach SGC verification service." };
  }
}

// ── TAG / ARS ─────────────────────────────────────────────────────────────────
async function lookupTAG(_certNumber: string): Promise<GradeLookupResult> {
  return {
    verified: false,
    error: "TAG does not offer a public cert verification API. Please enter your grade manually.",
  };
}

async function lookupARS(_certNumber: string): Promise<GradeLookupResult> {
  return {
    verified: false,
    error: "ARS does not currently offer public cert verification. Please enter your grade manually.",
  };
}

// ─────────────────────────────────────────────────────────────────────────────

const LOOKUP_FNS: Record<GradingCompany, (certNumber: string) => Promise<GradeLookupResult>> = {
  psa: lookupPSA,
  bgs: lookupBGS,
  cgc: lookupCGC,
  sgc: lookupSGC,
  tag: lookupTAG,
  ars: lookupARS,
};

export async function POST(req: NextRequest) {
  try {
    await requireAuth(req);
  } catch (err) {
    return authErrorResponse(err);
  }

  try {
    const body = await req.json();
    const company = body.company;
    const certNumber = sanitizeString(body.certNumber, 50);

    if (!isValidGradingCompany(company)) {
      return NextResponse.json({ error: "Invalid grading company" }, { status: 400 });
    }

    if (!certNumber || certNumber.length < 3) {
      return NextResponse.json({ error: "Invalid cert number" }, { status: 400 });
    }

    const lookupFn = LOOKUP_FNS[company as GradingCompany];
    const result = await lookupFn(certNumber);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Grade lookup failed" }, { status: 500 });
  }
}
