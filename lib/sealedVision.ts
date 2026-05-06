// Sealed product identification via Claude vision API.
//
// Separate from card vision — sealed products need different cues:
// box art, product name typography, set branding, language indicators.
// Returns structured SealedGuess via tool use (no JSON parse failures).

import Anthropic from "@anthropic-ai/sdk";
import { GAMES } from "./types";
import type { Game, SealedGuess, SealedProductType } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

const SEALED_PRODUCT_TYPES: SealedProductType[] = [
  "booster_pack", "booster_box", "elite_trainer_box", "tin",
  "bundle", "collection_box", "starter_deck", "blister_pack",
  "promo_pack", "case", "other",
];

// ---------------------------------------------------------------------------
// Tool schema
// ---------------------------------------------------------------------------

const IDENTIFY_SEALED_TOOL: Anthropic.Tool = {
  name: "identify_sealed_product",
  description: "Report the identified TCG sealed product details extracted from the image.",
  input_schema: {
    type: "object" as const,
    properties: {
      game: {
        type: "string",
        enum: [...GAMES],
        description: "The TCG game this product belongs to.",
      },
      productName: {
        type: "string",
        description: "Full product name as printed on the packaging (e.g. 'Scarlet & Violet Booster Box', 'Charizard ex Super Premium Collection').",
      },
      productType: {
        type: "string",
        enum: SEALED_PRODUCT_TYPES,
        description: "Type of sealed product.",
      },
      setName: {
        type: "string",
        description: "Set or expansion name this product belongs to (e.g. 'Scarlet & Violet', 'Temporal Forces', 'Bloomburrow').",
      },
      language: {
        type: "string",
        description: "Language of the product. Detect from text on packaging. Common: English, Japanese, Korean, French, German, Italian, Spanish, Portuguese, Chinese.",
      },
      edition: {
        type: "string",
        description: "Edition or print run if identifiable (e.g. '1st Edition', 'Unlimited', 'Shadowless'). Null if not applicable.",
      },
      confidence: {
        type: "number",
        description: "0.0–1.0 confidence score. 0.9+ = product name clearly readable. 0.7–0.89 = product identifiable but some details uncertain. Below 0.5 = cannot reliably identify.",
      },
      reasoning: {
        type: "string",
        description: "Brief explanation of what visual cues were used to identify this product.",
      },
    },
    required: ["confidence", "reasoning"],
  },
};

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an expert in TCG sealed products with encyclopedic knowledge of every major trading card game's booster boxes, Elite Trainer Boxes, tins, bundles, and collections.

YOUR JOB: Identify sealed TCG products from photos. Read the packaging text and branding clearly.

PRODUCT TYPE GUIDE:
- booster_pack: Single pack of cards (usually 10–12 cards). Small, foil-wrapped. Pokémon, MTG, YGO individual packs.
- booster_box: Full box of booster packs (Pokémon: 36 packs, MTG: 36 packs, YGO: 24 packs). Large rectangular box.
- elite_trainer_box: Pokémon ETB — contains 9 packs + accessories (dice, sleeves, dividers). "Elite Trainer Box" printed on box.
- tin: Metal tin container. Often contains packs + promo card(s). Pokémon tins, YGO tins.
- bundle: "Three-Pack Blister", "Build & Battle Box", "Value Pack". Multiple packs bundled with extras.
- collection_box: Premium collector's box — "Collection", "Premium Collection", "Super Premium Collection". Contains packs + promo card(s) + figurine or accessories.
- starter_deck: "Starter Deck", "Theme Deck", "Commander Deck" (MTG). Pre-built 60-card deck.
- blister_pack: Blister-packaged product — usually 1–3 packs + promo card. Sold at retail (Target, Walmart).
- promo_pack: Small pack containing only promo/special cards, not standard booster packs.
- case: A case of booster boxes (Pokémon: 6 boxes, MTG: 6 boxes). Large shipping box.
- other: Any other sealed TCG product.

LANGUAGE DETECTION:
- English: English text, "The Pokémon Company International", "Wizards of the Coast"
- Japanese: Japanese characters (kanji/hiragana/katakana), "株式会社ポケモン", "任天堂"
- Korean: Korean hangul characters
- German: "Pokémon", German language text, "Wizards of the Coast GmbH"
- French: French language text, "Pokémon France"
- Spanish/Italian/Portuguese: Look for text in those languages

EDITION DETECTION (especially Pokémon Base Set era):
- "1st Edition": "Edition 1" stamp or "1" stamp on box/pack
- "Shadowless": No shadow under the card image (Base Set only, rare)
- "Unlimited": Most modern product, no special marking needed

TCG-SPECIFIC PRODUCT NAMES:
POKÉMON: Sets like "Scarlet & Violet", "Paldea Evolved", "Obsidian Flames", "Paradox Rift", "Temporal Forces", "Twilight Masquerade", "Shrouded Fable", "Stellar Crown", "Crown Zenith", "Silver Tempest". ETBs are very common.
MTG: "Wilds of Eldraine", "The Lost Caverns of Ixalan", "Murders at Karlov Manor", "Bloomburrow", "Duskmourn". Draft Boosters, Set Boosters, Collector Boosters, Commander Decks.
YU-GI-OH: "Phantom Nightmare", "Legacy of Destruction", "Rage of the Abyss". 1st Edition vs Unlimited is important.
ONE PIECE: "OP-01" through "OP-10" sets. ST- starter decks.
FLESH AND BLOOD: "Bright Lights", "Heavy Hitters", "Part the Mistveil".

CONFIDENCE CALIBRATION:
- 0.90+: Product name, game, and product type all clearly readable on packaging
- 0.70–0.89: Product identifiable but set name or edition uncertain
- 0.50–0.69: Game and type clear but product name partially obscured
- Below 0.50: Cannot reliably identify — image too blurry or product unclear`;

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

export async function identifySealedProduct(
  imageBase64: string,
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif" = "image/jpeg"
): Promise<SealedGuess> {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    temperature: 0,
    system: SYSTEM_PROMPT,
    tools: [IDENTIFY_SEALED_TOOL],
    tool_choice: { type: "auto" },
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: imageBase64 },
          },
          {
            type: "text",
            text: "Identify this TCG sealed product. Read all visible text on the packaging carefully.",
          },
        ],
      },
    ],
  });

  // Extract tool use result
  const toolUse = response.content.find((b) => b.type === "tool_use");
  if (toolUse && toolUse.type === "tool_use") {
    const input = toolUse.input as Record<string, unknown>;
    return {
      game: validGame(input.game) ?? null,
      productName: typeof input.productName === "string" ? input.productName : null,
      productType: validProductType(input.productType) ?? null,
      setName: typeof input.setName === "string" ? input.setName : null,
      language: typeof input.language === "string" ? input.language : null,
      edition: typeof input.edition === "string" ? input.edition : null,
      confidence: typeof input.confidence === "number" ? input.confidence : 0,
      reasoning: typeof input.reasoning === "string" ? input.reasoning : "",
    };
  }

  return {
    game: null, productName: null, productType: null,
    setName: null, language: null, edition: null,
    confidence: 0, reasoning: "No tool use in response",
  };
}

function validGame(g: unknown): Game | null {
  if (typeof g === "string" && (GAMES as readonly string[]).includes(g)) return g as Game;
  return null;
}

function validProductType(t: unknown): SealedProductType | null {
  if (typeof t === "string" && (SEALED_PRODUCT_TYPES as string[]).includes(t)) return t as SealedProductType;
  return null;
}
