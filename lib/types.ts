// Shared types used across the app.

export type Game =
  | "pokemon"
  | "mtg"
  | "yugioh"
  | "onepiece"
  | "gundam"
  | "vanguard"
  | "digimon"
  | "lorcana"
  | "dragonball"
  | "fleshandblood"
  | "weissschwarz"
  | "finalfantasy"
  | "unionarena"
  | "battlespirits"
  | "riftbound"
  | "sports"
  | "other";

export const GAME_LABELS: Record<Game, string> = {
  pokemon: "Pokémon",
  mtg: "Magic: The Gathering",
  yugioh: "Yu-Gi-Oh!",
  onepiece: "One Piece",
  gundam: "Gundam",
  vanguard: "Cardfight!! Vanguard",
  digimon: "Digimon",
  lorcana: "Disney Lorcana",
  dragonball: "Dragon Ball Super",
  fleshandblood: "Flesh and Blood",
  weissschwarz: "Weiss Schwarz",
  finalfantasy: "Final Fantasy TCG",
  unionarena: "Union Arena",
  battlespirits: "Battle Spirits Saga",
  riftbound: "Riftbound",
  sports: "Sports",
  other: "Other"
};

// Games with dedicated free APIs for card data (images, set info, etc.)
export const GAMES_WITH_DEDICATED_API: Game[] = [
  "pokemon", "mtg", "yugioh", "onepiece", "digimon", "lorcana"
];

// All games supported by JustTCG for pricing data
export const GAMES_WITH_PRICING: Game[] = [
  "pokemon", "mtg", "yugioh", "onepiece", "gundam", "digimon",
  "lorcana", "dragonball", "fleshandblood", "unionarena", "sports"
];

// Legacy alias — kept for backward compat in components that reference it
export const GAMES_WITH_API: Game[] = GAMES_WITH_DEDICATED_API;

export type Condition =
  | "Near Mint"
  | "Lightly Played"
  | "Moderately Played"
  | "Heavily Played"
  | "Damaged";

export const CONDITIONS: Condition[] = [
  "Near Mint",
  "Lightly Played",
  "Moderately Played",
  "Heavily Played",
  "Damaged"
];

// Professional grading companies
export type GradingCompany = "psa" | "bgs" | "cgc" | "sgc" | "tag" | "ars";

export const GRADING_COMPANIES: { key: GradingCompany; label: string; scaleMax: number }[] = [
  { key: "psa", label: "PSA", scaleMax: 10 },
  { key: "bgs", label: "BGS (Beckett)", scaleMax: 10 },
  { key: "cgc", label: "CGC", scaleMax: 10 },
  { key: "sgc", label: "SGC", scaleMax: 10 },
  { key: "tag", label: "TAG", scaleMax: 10 },
  { key: "ars", label: "ARS", scaleMax: 10 },
];

export const GRADING_COMPANY_LABELS: Record<GradingCompany, string> = {
  psa: "PSA",
  bgs: "BGS (Beckett)",
  cgc: "CGC",
  sgc: "SGC",
  tag: "TAG",
  ars: "ARS",
};

// Grading info for a professionally graded (slabbed) card
export interface GradingInfo {
  company: GradingCompany;
  grade: string;          // e.g. "10", "9.5", "Pristine 10"
  certNumber?: string;    // Certificate / serial number for verification
  subgrades?: Record<string, string>; // BGS sub-grades: { centering: "9.5", edges: "10", ... }
  verified?: boolean;     // true if cert was verified via API lookup
  verifiedAt?: number;    // timestamp of last verification
  label?: string;         // Label type: "standard", "gold", "black", etc.
  population?: number;    // Pop count from grading company
}

// Source of the data for a card: how was it identified?
export type IdentificationSource = "vision" | "manual" | "mock" | "verified";

// A single photo attached to a card, with a role.
export type PhotoRole = "front" | "back" | "extra";

export interface CardPhoto {
  id: string;       // unique id per photo
  role: PhotoRole;
  dataUrl: string;   // base64 data URL for display
}

// Canonical card record used throughout the app and for exports.
export interface ScannedCard {
  id: string; // local uuid
  game: Game;
  name: string;
  setName?: string;
  setCode?: string;
  collectorNumber?: string;
  rarity?: string;
  imageUrl?: string; // Official art URL from API
  uploadedImageDataUrl?: string; // The first photo the user uploaded (legacy, kept for compat)
  photos: CardPhoto[]; // All user photos: front, back, extras
  marketPriceUsd?: number;
  condition: Condition;
  quantity: number;
  foil: boolean;
  language: string;
  notes?: string;
  identificationSource: IdentificationSource;
  identificationConfidence?: number; // 0-1 when vision is used
  externalUrl?: string; // Link to the canonical entry (Scryfall, PokemonTCG, etc.)
  listingTitle?: string;       // Custom title override (if set, used instead of template)
  listingDescription?: string; // Custom description override
  // ---- Grading (slabbed cards) ----
  slabbed?: boolean;           // true if professionally graded
  grading?: GradingInfo;       // Grading details when slabbed
  // ---- Platform-specific fields ----
  sku?: string;                // User's custom SKU for inventory tracking
  listPrice?: number;          // Computed or user-set list price for selling
  ebayListingId?: string;      // eBay item ID once listed
  ebayOfferId?: string;        // eBay offer ID (Inventory API)
  createdAt: number;
}

// Card type (what kind of card is being scanned)
export type CardType =
  | "single"       // Standard single card
  | "graded"       // Professionally graded slab
  | "sealed"       // Sealed product (booster, ETB, etc.)
  | "lot"          // Bulk lot of cards
  | "accessory";   // Sleeves, binders, playmats, etc.

export const CARD_TYPE_LABELS: Record<CardType, string> = {
  single: "Single Card",
  graded: "Graded / Slabbed",
  sealed: "Sealed Product",
  lot: "Lot / Bulk",
  accessory: "Accessory",
};

// Card finish / foil type
export type CardFinish =
  | "non-holo"
  | "holo"
  | "reverse-holo"
  | "full-art"
  | "etched"
  | "gold"
  | "textured"
  | "any";

export const CARD_FINISH_LABELS: Record<CardFinish, string> = {
  "non-holo": "Non-Holo",
  holo: "Holo / Holofoil",
  "reverse-holo": "Reverse Holo",
  "full-art": "Full Art",
  etched: "Etched Foil",
  gold: "Gold",
  textured: "Textured",
  any: "Any / Mixed",
};

// Image capture mode for a batch
export type ImageMode = "front-only" | "front-and-back";

// Batch configuration — set before scanning begins.
export interface BatchConfig {
  name: string;                        // Batch name
  game: Game;                          // TCG being scanned
  includeSets: string[];               // Set codes/names to include (empty = all)
  excludeSets: string[];               // Set codes/names to exclude
  templateId?: string;                 // Listing template to use
  platform?: ExportPlatform;           // Target platform for listings
  ebayCategoryId?: string;             // eBay store category ID
  ebayCategoryName?: string;           // eBay store category display name
  floorPrice?: number;                 // Minimum listing price (USD)
  ceilingPrice?: number;               // Maximum listing price (USD)
  priceMultiplier: number;             // Multiplier on market price (e.g. 1.1 = 10% markup)
  pricingStrategy?: string;            // PricingStrategy key from pricingEngine
  undercutPercent?: number;            // Undercut % when using UNDERCUT strategy
  priceRounding?: string;              // RoundingRule key from pricingEngine
  imageMode: ImageMode;                // Whether batch expects front-only or front+back
  defaultCondition: Condition;         // Pre-fill condition for scanned cards
  cardType: CardType;                  // What kind of product
  finish: CardFinish;                  // Foil / finish type
  language: string;                    // Card language
  notes?: string;                      // Extra context for vision / listing
}

// Sensible defaults for a new batch
export const DEFAULT_BATCH_CONFIG: BatchConfig = {
  name: "",
  game: "pokemon",
  includeSets: [],
  excludeSets: [],
  priceMultiplier: 1.0,
  imageMode: "front-only",
  defaultCondition: "Near Mint",
  cardType: "single",
  finish: "any",
  language: "English",
};

// Supported export/listing platforms
export type ExportPlatform = "ebay" | "tcgplayer" | "whatnot" | "shopify" | "squarespace" | "generic";

export const PLATFORM_LABELS: Record<ExportPlatform, string> = {
  ebay: "eBay",
  tcgplayer: "TCGPlayer",
  whatnot: "Whatnot",
  shopify: "Shopify",
  squarespace: "Squarespace",
  generic: "Generic CSV",
};

// Listing template — reusable title/description patterns.
export interface ListingTemplate {
  id: string;
  name: string;                // e.g. "Pokemon eBay Standard"
  titlePattern: string;        // e.g. "{name} {setName} #{collectorNumber} {rarity} {condition} Pokemon TCG"
  descriptionPattern: string;  // e.g. "You are purchasing: {name} from {setName}..."
  platform: ExportPlatform;
  game?: Game;                 // If set, only applies to this game
}

// Scan profile — reusable preset combining scan hints and listing format.
export interface ScanProfile {
  id: string;
  name: string;                    // e.g. "Pokémon SV Bulk"
  // ---- Scan hints (sent to vision & lookup) ----
  game?: Game;                     // TCG to expect
  setName?: string;                // Set to focus on (e.g. "Surging Sparks")
  setCode?: string;                // Set code hint (e.g. "SSP")
  rarity?: string;                 // Expected rarity (e.g. "Rare Holo")
  foilType?: string;               // e.g. "Holofoil", "Reverse Holo", "Full Art", "None"
  excludeSets?: string[];          // Set codes/names to skip during lookup
  defaultCondition?: Condition;    // Pre-fill condition for scanned cards
  language?: string;               // e.g. "English", "Japanese"
  notes?: string;                  // Extra context sent to vision prompt
  // ---- Listing format ----
  titlePattern?: string;           // Listing title template
  descriptionPattern?: string;     // Listing description template
  platform?: ExportPlatform;
  createdAt: number;
  updatedAt: number;
}

// Built-in template variables that can be used in patterns:
// {name}, {game}, {gameFull}, {setName}, {setCode}, {collectorNumber},
// {rarity}, {condition}, {foil}, {language}, {price},
// {gradingCompany}, {grade}, {certNumber}, {slabbed}, {sku}
export const TEMPLATE_VARIABLES = [
  "name", "game", "gameFull", "setName", "setCode", "collectorNumber",
  "rarity", "condition", "foil", "language", "price",
  "gradingCompany", "grade", "certNumber", "slabbed", "sku"
] as const;

// What the vision model is expected to return for a single photo.
export interface VisionGuess {
  game: Game | null;
  name: string | null;
  setName?: string | null;
  setCode?: string | null;
  collectorNumber?: string | null;
  confidence: number; // 0-1
  reasoning?: string;
  isCardBack?: boolean; // true when the image shows the reverse side of a card
  language?: string; // detected card language (e.g. "English", "Japanese", "Korean")
}

// Result from the /api/scan endpoint, one entry per uploaded image.
export interface ScanResult {
  visionGuess?: VisionGuess;
  matchedCard?: Partial<ScannedCard> & { name: string; game: Game };
  needsManualEntry: boolean;
  note?: string;
  isCardBack?: boolean; // true when vision detected a card back, not a front
}
