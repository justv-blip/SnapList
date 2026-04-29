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

// PSA cert lookup via their public verification page
async function lookupPSA(certNumber: string): Promise<GradeLookupResult> {
  try {
    const res = await fetch(
      `https://www.psacard.com/cert/${encodeURIComponent(certNumber)}`,
      {
        headers: {
          "User-Agent": "TCGScanner/1.0",
          "Accept": "text/html",
        },
      }
    );
    if (!res.ok) return { verified: false, error: "PSA cert not found" };

    const html = await res.text();

    // Extract grade from PSA cert page
    const gradeMatch = html.match(/class="card-grade[^"]*"[^>]*>([^<]+)/i)
      || html.match(/Grade:\s*<[^>]+>([^<]+)/i)
      || html.match(/"grade"\s*:\s*"([^"]+)"/i);
    const grade = gradeMatch?.[1]?.trim();

    // Extract card description
    const descMatch = html.match(/class="card-desc[^"]*"[^>]*>([^<]+)/i)
      || html.match(/"description"\s*:\s*"([^"]+)"/i);
    const cardName = descMatch?.[1]?.trim();

    // Extract population
    const popMatch = html.match(/Population:\s*(\d+)/i)
      || html.match(/"population"\s*:\s*(\d+)/i);
    const population = popMatch ? parseInt(popMatch[1], 10) : undefined;

    if (grade) {
      return { verified: true, grade, cardName, population };
    }
    return { verified: false, error: "Could not extract grade from PSA page" };
  } catch {
    return { verified: false, error: "Failed to reach PSA verification service" };
  }
}

// BGS (Beckett) cert lookup
async function lookupBGS(certNumber: string): Promise<GradeLookupResult> {
  try {
    const res = await fetch(
      `https://www.beckett.com/grading/card-lookup?serial_number=${encodeURIComponent(certNumber)}`,
      {
        headers: { "User-Agent": "TCGScanner/1.0", "Accept": "text/html" },
      }
    );
    if (!res.ok) return { verified: false, error: "BGS cert not found" };

    const html = await res.text();

    const gradeMatch = html.match(/Final\s*Grade[^<]*<[^>]+>([^<]+)/i)
      || html.match(/"overall_grade"\s*:\s*"?([^",}]+)/i);
    const grade = gradeMatch?.[1]?.trim();

    // BGS sub-grades
    const subgrades: Record<string, string> = {};
    const subMatches = html.matchAll(/(Centering|Corners|Edges|Surface)[^<]*<[^>]+>([^<]+)/gi);
    for (const m of subMatches) {
      subgrades[m[1].toLowerCase()] = m[2].trim();
    }

    if (grade) {
      return {
        verified: true,
        grade,
        subgrades: Object.keys(subgrades).length > 0 ? subgrades : undefined,
      };
    }
    return { verified: false, error: "Could not extract grade from Beckett page" };
  } catch {
    return { verified: false, error: "Failed to reach BGS verification service" };
  }
}

// CGC cert lookup
async function lookupCGC(certNumber: string): Promise<GradeLookupResult> {
  try {
    const res = await fetch(
      `https://www.cgccards.com/certlookup/${encodeURIComponent(certNumber)}/`,
      {
        headers: { "User-Agent": "TCGScanner/1.0", "Accept": "text/html" },
      }
    );
    if (!res.ok) return { verified: false, error: "CGC cert not found" };

    const html = await res.text();

    const gradeMatch = html.match(/Grade[^<]*<[^>]+>([^<]+)/i)
      || html.match(/"grade"\s*:\s*"?([^",}]+)/i);
    const grade = gradeMatch?.[1]?.trim();

    if (grade) {
      return { verified: true, grade };
    }
    return { verified: false, error: "Could not extract grade from CGC page" };
  } catch {
    return { verified: false, error: "Failed to reach CGC verification service" };
  }
}

// SGC cert lookup
async function lookupSGC(certNumber: string): Promise<GradeLookupResult> {
  try {
    const res = await fetch(
      `https://www.gosgc.com/card-certification-verification?cert=${encodeURIComponent(certNumber)}`,
      {
        headers: { "User-Agent": "TCGScanner/1.0", "Accept": "text/html" },
      }
    );
    if (!res.ok) return { verified: false, error: "SGC cert not found" };

    const html = await res.text();

    const gradeMatch = html.match(/Grade[^<]*<[^>]+>([^<]+)/i)
      || html.match(/"grade"\s*:\s*"?([^",}]+)/i);
    const grade = gradeMatch?.[1]?.trim();

    if (grade) {
      return { verified: true, grade };
    }
    return { verified: false, error: "Could not extract grade from SGC page" };
  } catch {
    return { verified: false, error: "Failed to reach SGC verification service" };
  }
}

// TAG — falls back to manual entry (no public verification page)
async function lookupTAG(_certNumber: string): Promise<GradeLookupResult> {
  return {
    verified: false,
    error: "TAG does not offer public cert verification. Please enter grade manually.",
  };
}

// ARS (Japanese grading company) — limited public API
async function lookupARS(_certNumber: string): Promise<GradeLookupResult> {
  return {
    verified: false,
    error: "ARS does not currently offer public cert verification. Please enter grade manually.",
  };
}

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
      return NextResponse.json(
        { error: "Invalid grading company" },
        { status: 400 }
      );
    }

    if (!certNumber || certNumber.length < 3) {
      return NextResponse.json(
        { error: "Invalid cert number" },
        { status: 400 }
      );
    }

    const lookupFn = LOOKUP_FNS[company as GradingCompany];
    const result = await lookupFn(certNumber);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Grade lookup failed" },
      { status: 500 }
    );
  }
}
