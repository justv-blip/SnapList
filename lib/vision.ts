// Vision-based card identification via Claude's vision API.
//
// Pipeline:
//   Pass 1 — fast identification (all fields)
//   Pass 2 — targeted retry if confidence < RETRY_THRESHOLD or collector number missing
//
// Uses tool use for structured output (guaranteed typed fields, no JSON parse failures).
// Temperature 0 on all calls for deterministic results.

import Anthropic from "@anthropic-ai/sdk";
import type { Game, VisionGuess } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const RETRY_THRESHOLD = 0.75; // below this OR missing collector number → second pass

// ---------------------------------------------------------------------------
// Tool schema — forces structured output, eliminates JSON parse failures
// ---------------------------------------------------------------------------

const IDENTIFY_TOOL: Anthropic.Tool = {
  name: "identify_card",
  description: "Report the identified TCG card details extracted from the image.",
  input_schema: {
    type: "object" as const,
    properties: {
      game: {
        type: "string",
        enum: [
          "pokemon", "mtg", "yugioh", "onepiece", "gundam", "vanguard",
          "digimon", "lorcana", "dragonball", "fleshandblood", "weissschwarz",
          "finalfantasy", "unionarena", "battlespirits", "riftbound", "sports", "other"
        ],
        description: "The TCG game this card belongs to. Omit or set null if unidentifiable."
      },
      name: {
        type: "string",
        description: "Exact card name as printed. Null if unreadable."
      },
      setName: {
        type: "string",
        description: "Full set/expansion name if visible."
      },
      setCode: {
        type: "string",
        description: "Printed set abbreviation, verbatim from the card (e.g. SSP, MH3, OP01)."
      },
      collectorNumber: {
        type: "string",
        description: "Collector number verbatim from the card (e.g. 123/456, OP01-001, BT1-025). Critical — always look at the bottom of the card."
      },
      language: {
        type: "string",
        description: "Language printed on the card. Detect by reading the text. Common values: English, Japanese, Korean, French, German, Italian, Spanish, Portuguese, Chinese (Simplified), Chinese (Traditional)."
      },
      confidence: {
        type: "number",
        description: "0.0–1.0. See calibration guide in system prompt."
      },
      reasoning: {
        type: "string",
        description: "Brief explanation of how you identified the card and what visual cues you used."
      },
      isCardBack: {
        type: "boolean",
        description: "True if this is the back/reverse side of a card — shows game logo/pattern but no card-specific info."
      }
    },
    required: ["confidence", "reasoning", "isCardBack"]
  }
};

// ---------------------------------------------------------------------------
// System prompt — pass 1 (full identification)
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert TCG card identifier with encyclopedic knowledge of every major trading card game. Your job is to extract precise card identity from a photo.

CONFIDENCE CALIBRATION — be honest, not optimistic:
- 0.95+  Every field is clearly readable: name, set code, and collector number all visible and unambiguous.
- 0.80–0.94  Name and game are certain; set code or collector number may be partially obscured.
- 0.60–0.79  Name is likely correct but set/collector number is guessed or inferred.
- 0.40–0.59  Game is known, card name is uncertain (blurry, cut off, or uncommon card).
- 0.00–0.39  Cannot reliably identify — image too dark/blurry, card back shown, or not a TCG card.

COLLECTOR NUMBER — this is the most commonly missed field. Always:
- Check the BOTTOM of the card first. It is nearly always there.
- For Pokémon: bottom-right corner, format XXX/YYY (e.g. 025/198)
- For MTG: bottom-left, format NNN/NNN (e.g. 001/261) — also check for ★ on mythics
- For Yu-Gi-Oh: bottom-left, short alphanumeric (e.g. LOB-EN001, PHNI-EN045)
- For One Piece: bottom area, format OP##-### (e.g. OP01-001)
- For Digimon: bottom area, format BT#-### or EX#-### (e.g. BT1-001)
- For sports: back of card or bottom, usually a card number like "123" or "RC-14"
Never leave collectorNumber null if you can see the bottom of the card clearly.

CARD BACK DETECTION — set isCardBack: true when:
- Pokémon: shows the Poké Ball + "Pokémon" text design (red/white/blue)
- MTG: shows the blue oval "Magic: The Gathering" design
- Yu-Gi-Oh: shows the dark triangular swirl pattern
- One Piece / Digimon / other Bandai: shows the generic game-logo back design
- Sports cards: shows a stats table, career statistics, player bio, or team info WITHOUT a large action/portrait photo as the primary subject. The back typically has rows of season stats (yards, touchdowns, ERA, points, win/loss record for UFC/MMA, etc.), birthdate, height/weight, brief bio paragraph, and a card number. Usually manufacturer legal text at the very bottom.
If isCardBack is true → set name to null, setCode to null, collectorNumber to null, confidence to 0.

GAME IDENTIFICATION — use these visual cues:

POKÉMON: HP stat next to the name. Set symbol in bottom-left corner. Collector number "XXX/YYY" at bottom-right. Energy type symbols. "Pokémon" branding at bottom.

MAGIC: THE GATHERING (MTG): Mana cost symbols (colored circles) in upper-right. Set expansion symbol (icon) at mid-right of the art box. Power/toughness "N/N" for creatures at bottom-right. "Wizards of the Coast" or "WotC" at bottom. Collector number bottom-left.

YU-GI-OH!: Level stars OR Rank stars OR Link arrows beneath the card name. ATK/DEF or LINK value at bottom. "KONAMI" branding. Set code like "LOB-EN001" bottom-left. Card name is usually in all caps or small caps.

ONE PIECE CARD GAME: Colored cost circles top-left (red/green/blue/purple/black/yellow). Power stat bottom-left. "ONE PIECE CARD GAME" at bottom. "BANDAI" logo. Collector numbers OP##-### format.

GUNDAM CARD GAME: Mobile suit / mech artwork. "GUNDAM" or "GCG" branding. Bandai logo. Distinctive robot art. Set codes like GD01.

CARDFIGHT!! VANGUARD: "VANGUARD" text. Shield value. Grade indicator (Grade 0–4). Bushiroad logo. Trigger icons. Card numbers like BT01/001.

DIGIMON CARD GAME: "DIGIMON CARD GAME" at top. Play cost top-left. Digivolution cost hexagons on left side. DP (Digimon Power) stat. Bandai logo. Card numbers BT#-### or EX#-### or ST#-##.

DISNEY LORCANA: "Disney Lorcana" branding. Ink cost (hexagonal symbols) top-left. Lore diamonds. Willpower and strength stats. Ravensburger logo. Illumineer's Quest/Rise of the Floodborn etc. set names.

DRAGON BALL SUPER CARD GAME: "DRAGON BALL" text. Combo power value. Energy cost on left side. Bandai logo. "DRAGON BALL SUPER CARD GAME" at bottom. Card numbers BT#-### format.

FLESH AND BLOOD: "Flesh and Blood" branding. Resource cost top-left. Attack and defense values. Colored pitch strip on the left edge (red/yellow/blue). Card number at bottom. Legend Story Studios branding.

WEISS SCHWARZ: Anime art (often cute/moe style). "weiß schwarz" branding. Level and cost in top corners. Power stat. Soul trigger icons. Bushiroad logo. Card number format SAO/S20-001 or similar.

FINAL FANTASY TCG: "FINAL FANTASY" text. Crystal Point (CP) cost in colored circles at corners. Power stat. Square Enix branding. Card numbers 1-001R, 2-145L format.

UNION ARENA: "UNION ARENA" text. Bandai logo. Various anime IP artwork (Bleach, Naruto, etc.). Action Point cost. Card numbers UA##BT/xxx.

BATTLE SPIRITS SAGA: "BATTLE SPIRITS SAGA" text. Bandai logo. Core cost symbols. BP (Battle Power) stat. Card numbers BSS##-### format.

RIFTBOUND (Runeterra Card Game): Based on the League of Legends / Runeterra universe. Champion and unit artwork featuring LoL characters (Jinx, Vi, Jayce, etc.). "RIFTBOUND" or "Runeterra" branding. Riot Games logo. Mana/power costs in colored region indicators (Demacia, Noxus, Freljord, etc.). Card numbers in format like RB-001.

SPORTS CARDS: Real athlete/fighter photos. Licensed manufacturer branding is the primary identifier — look for it at the bottom or back of every card.

MANUFACTURER BRANDS — always read the brand name, it is critical for the set name:
- TOPPS: "Topps" wordmark or crown logo. Makes baseball (Topps Series 1/2, Topps Chrome, Bowman, Stadium Club, Allen & Ginter), UFC (Topps UFC), and more. Chrome versions have a reflective holographic finish.
- PANINI: "Panini" or "panini america" wordmark. Makes football (Prizm, Select, Mosaic, Donruss, Score, Contenders, National Treasures), basketball (Prizm, Hoops, Crown Royale), soccer (Prizm, Chronicles), and more. Prizm cards have a rainbow prism border.
- UPPER DECK: "Upper Deck" wordmark. Primarily hockey (Young Guns, SP Authentic, The Cup) and some basketball/baseball. Hologram sticker on back for authentication.
- DONRUSS / SCORE: "Donruss" or "Score" (Panini brands). Football and baseball sets.
- FLEER / SKYBOX: Older brands from 1980s–2000s. "Fleer" or "SkyBox" text.
- LEAF: "Leaf" wordmark. Multi-sport autograph and memorabilia cards.
- BOWMAN: "Bowman" (Topps brand). Baseball prospects and rookies. Chrome versions very common.

SPORT IDENTIFICATION — identify the sport from the action photo AND team/league logos:
- FOOTBALL (NFL/NCAA): Helmets, shoulder pads, football, NFL shield logo or NCAA branding, team wordmarks (Chiefs, Cowboys, Eagles, etc.), player position abbreviations (QB, RB, WR, TE, OL, DL, LB, CB, S)
- BASKETBALL (NBA/NCAA): Basketball court, jersey numbers, NBA logo or NCAA, team names (Lakers, Celtics, Warriors, etc.), player position (PG, SG, SF, PF, C)
- BASEBALL (MLB/MiLB): Baseball diamond, batting/pitching poses, MLB logo, team logos (Yankees, Dodgers, Cubs, etc.), player positions (P, C, 1B, 2B, 3B, SS, OF, DH)
- SOCCER (MLS/EPL/international): Soccer pitch, cleats, club crests (Barcelona, Real Madrid, Man City, etc.) or national team crests, "La Liga" / "Premier League" / "Champions League" branding
- UFC / MMA: Octagon cage background, UFC logo (red/black), fighter in MMA gloves and shorts, "UFC" wordmark prominently displayed, fighter record (W-L), weight class (Lightweight, Heavyweight, etc.). Made by Topps.
- HOCKEY (NHL): Ice rink, skates, hockey stick and puck, NHL shield logo, team logos (Maple Leafs, Canadiens, Penguins, etc.), goalie mask art
- GOLF: Golf course or driving range, golfer in swing pose, PGA Tour / LIV Golf branding, player name and world ranking
- WRESTLING (WWE/AEW): Wrestling ring, championship belts, WWE logo or AEW "All Elite Wrestling" branding, wrestler in performance gear

PREMIUM CARD TYPES (affect value — note in setName when visible):
- Autograph / Auto: On-card or sticker signature
- Relic / Patch / Jersey: Embedded fabric swatch, often labeled "Memorabilia" or "Relic"
- Rookie Card (RC): First officially licensed card of a player, "RC" shield or "Rookie Card" text
- Numbered parallels: "/10", "/25", "/50", "/99", "/149", "/199" printed on the card — always capture this in collectorNumber or setName
- Refractor / Prizm / Chrome: Reflective holographic surface

LANGUAGE DETECTION:
- Japanese: katakana/hiragana/kanji characters. Still try to provide the English card name if you know it (e.g. set name = "Surging Sparks" even if the card is Japanese).
- Korean: Hangul script (각, 가, 나 etc.)
- Chinese: traditional or simplified Han characters without kana
- When in doubt about name, provide the name in the printed language.

AMBIGUOUS CASES:
- Proxy / fan-made card: usually low print quality, non-standard layout, missing official logos — set confidence < 0.4
- Card sleeve or deck box showing a card image: treat as card back (isCardBack: true)
- Multiple cards in frame: identify the most prominent/centered one only
- Card at steep angle: still attempt ID, but lower confidence appropriately`;

// ---------------------------------------------------------------------------
// Game-specific targeted prompts for pass 2
// ---------------------------------------------------------------------------

const GAME_RETRY_HINTS: Partial<Record<Game, string>> = {
  pokemon: "Focus on the bottom-right corner for the collector number (format: XXX/YYY, e.g. 025/198). The set code is the abbreviation near the bottom-left (e.g. SSP, SV1, PAL). The HP is next to the name.",
  mtg: "Focus on the bottom-left for the collector number (e.g. 001/261). The set symbol is the icon at the mid-right of the artwork. Mana cost is in the top-right corner. Check if it's a basic land (no collector number format may differ).",
  yugioh: "Focus on the bottom-left for the set code (e.g. PHNI-EN045). The card name is at the very top. Check for ATK/DEF values at the bottom-right.",
  onepiece: "Focus on the collector number at the bottom in OP##-### format (e.g. OP01-001). The cost circle is top-left. Check for Don!! cost value.",
  digimon: "Focus on the collector number at the bottom in BT#-### or EX#-### format (e.g. BT1-001). The play cost is top-left. Check for the Digimon level.",
  lorcana: "Focus on the bottom for the collector number. Check top-left for ink cost, and read the full card name which may include a subtitle after a dash.",
  riftbound: "Focus on the card number (format RB-### or similar). Read the champion/unit name at the top. Check for region indicators (Demacia, Noxus, Freljord, Piltover, Shadow Isles, etc.) and the Riot Games / Riftbound branding.",
  sports: "Focus on: (1) the card number — usually bottom-right or bottom-left of the front, or anywhere on the back; (2) the manufacturer brand — Topps, Panini, Upper Deck, Bowman, Donruss, Fleer, etc. — read it exactly as printed; (3) the set name — e.g. 'Topps Chrome', 'Panini Prizm', 'Bowman Draft', 'Topps UFC'; (4) the player name — read exactly as printed; (5) the sport — identified from action photo, uniforms, team logos, and league branding; (6) any parallel/numbered designation — '/25', '/99', 'Prizm', 'Refractor', 'Gold', etc.",
};

function buildRetryPrompt(first: VisionGuess, hints?: ScanHints): string {
  const parts: string[] = [
    "This is a second identification attempt. The first pass returned low confidence or missing fields.",
  ];

  if (first.game) {
    parts.push(`Game identified as: ${first.game}.`);
    const gameHint = GAME_RETRY_HINTS[first.game as Game];
    if (gameHint) parts.push(gameHint);
  }
  if (first.name) parts.push(`Likely card name: ${first.name} — confirm or correct.`);
  if (!first.collectorNumber) parts.push("Collector number was NOT found in the first pass — look very carefully at the bottom of the card.");
  if (!first.setCode) parts.push("Set code was NOT found — look for the abbreviation near the collector number.");

  if (hints) {
    if (hints.game && !first.game) parts.push(`User-provided game hint: ${hints.game}`);
    if (hints.setCode) parts.push(`User-provided set code hint: ${hints.setCode}`);
    if (hints.setName) parts.push(`User-provided set name hint: ${hints.setName}`);
    if (hints.language && hints.language !== "English") parts.push(`Expected language: ${hints.language}`);
    if (hints.notes) parts.push(`Additional context: ${hints.notes}`);
  }

  parts.push("Call identify_card with your best identification. Be precise about the collector number.");
  return parts.join("\n");
}

function buildFirstPrompt(hints?: ScanHints): string {
  if (!hints) return "Identify this card and call identify_card with your findings.";

  const parts: string[] = ["Identify this card and call identify_card with your findings."];
  const hintParts: string[] = [];

  if (hints.game) hintParts.push(`Game: ${hints.game}`);
  if (hints.setName) hintParts.push(`Expected set: ${hints.setName}`);
  if (hints.setCode) hintParts.push(`Set code hint: ${hints.setCode}`);
  if (hints.rarity) hintParts.push(`Rarity: ${hints.rarity}`);
  if (hints.foilType && hints.foilType !== "None") hintParts.push(`Foil type: ${hints.foilType}`);
  if (hints.language && hints.language !== "English") hintParts.push(`Expected language: ${hints.language}`);
  if (hints.notes) hintParts.push(`Context: ${hints.notes}`);

  if (hintParts.length > 0) {
    parts.push(`\nUser hints (use to narrow down, but verify against the card):\n${hintParts.join("\n")}`);
  }

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScanHints {
  game?: string;
  setName?: string;
  setCode?: string;
  rarity?: string;
  foilType?: string;
  language?: string;
  notes?: string;
}

interface VisionInput {
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
  hints?: ScanHints;
}

// ---------------------------------------------------------------------------
// Core API call — single pass
// ---------------------------------------------------------------------------

async function runIdentification(
  client: Anthropic,
  input: VisionInput,
  userText: string
): Promise<VisionGuess> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 512,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools: [IDENTIFY_TOOL],
    tool_choice: { type: "tool", name: "identify_card" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: input.mediaType, data: input.base64 },
          },
          { type: "text", text: userText },
        ],
      },
    ],
  });

  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    return { game: null, name: null, confidence: 0, reasoning: "Model did not call identify_card tool." };
  }

  const raw = toolUse.input as Record<string, unknown>;
  return {
    game: validGame(raw.game),
    name: (raw.name as string) || null,
    setName: (raw.setName as string) || null,
    setCode: (raw.setCode as string) || null,
    collectorNumber: (raw.collectorNumber as string) || null,
    language: (raw.language as string) || undefined,
    confidence: typeof raw.confidence === "number" ? raw.confidence : 0,
    reasoning: (raw.reasoning as string) || undefined,
    isCardBack: raw.isCardBack === true,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function isVisionEnabled(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function identifyCard(input: VisionInput): Promise<VisionGuess> {
  if (!isVisionEnabled()) {
    return { game: null, name: null, confidence: 0, reasoning: "ANTHROPIC_API_KEY not set — vision disabled." };
  }

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, timeout: 30_000 });

  // Pass 1 — fast full identification
  const first = await runIdentification(client, input, buildFirstPrompt(input.hints));

  // Early exit if confident and complete
  const needsRetry = first.confidence < RETRY_THRESHOLD || (!first.collectorNumber && !first.isCardBack);
  if (!needsRetry) return first;

  // Pass 2 — targeted retry using what we know from pass 1
  try {
    const second = await runIdentification(client, input, buildRetryPrompt(first, input.hints));
    // Return whichever pass produced higher confidence, preferring second on a tie (it had more context)
    return second.confidence >= first.confidence ? second : first;
  } catch {
    // If retry fails for any reason, the first pass result is still valid
    return first;
  }
}

// ---------------------------------------------------------------------------
// Kept for tests / direct callers that still parse raw text
// ---------------------------------------------------------------------------

export function parseVisionResponse(raw: string): VisionGuess {
  if (!raw) return { game: null, name: null, confidence: 0, reasoning: "empty response" };
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  const jsonStr = start >= 0 && end > start ? cleaned.slice(start, end + 1) : cleaned;
  try {
    const parsed = JSON.parse(jsonStr);
    return {
      game: validGame(parsed.game),
      name: parsed.name || null,
      setName: parsed.setName || null,
      setCode: parsed.setCode || null,
      collectorNumber: parsed.collectorNumber || null,
      confidence: typeof parsed.confidence === "number" ? parsed.confidence : 0,
      reasoning: parsed.reasoning || undefined,
      isCardBack: parsed.isCardBack === true,
      language: parsed.language || undefined,
    };
  } catch {
    return { game: null, name: null, confidence: 0, reasoning: "Vision returned unparseable JSON." };
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const VALID_GAMES: Game[] = [
  "pokemon", "mtg", "yugioh", "onepiece", "gundam", "vanguard",
  "digimon", "lorcana", "dragonball", "fleshandblood", "weissschwarz",
  "finalfantasy", "unionarena", "battlespirits", "riftbound", "sports", "other",
];

function validGame(g: unknown): Game | null {
  if (typeof g === "string" && (VALID_GAMES as string[]).includes(g)) return g as Game;
  return null;
}
