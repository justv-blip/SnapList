// Exporters for card inventory. Supports:
//   - eBay bulk-listing CSV (File Exchange format)
//   - TCGPlayer Seller Portal CSV
//   - Generic JSON and generic CSV
//
// Templates are used for title and description generation when provided.

import type { ListingTemplate, ScannedCard, ExportPlatform } from "./types";
import { GAME_LABELS, GRADING_COMPANY_LABELS } from "./types";
import { generateListingTitle, generateListingDescription, DEFAULT_TEMPLATES } from "./templates";
import { computeListPrice, DEFAULT_PRICING_CONFIG, type PricingConfig } from "./pricingEngine";
import { calculateFees, DEFAULT_SELLER_COSTS, type SellerCosts } from "./platformFees";

export type ExportFormat = "ebay" | "tcgplayer" | "whatnot" | "shopify" | "squarespace" | "json" | "csv";

export interface ExportResult {
  filename: string;
  mimeType: string;
  body: string;
}

export function exportCards(
  cards: ScannedCard[],
  format: ExportFormat,
  templates?: ListingTemplate[],
  pricingConfig?: PricingConfig
): ExportResult {
  const tmpl = templates && templates.length > 0 ? templates : DEFAULT_TEMPLATES;
  const pc = pricingConfig || DEFAULT_PRICING_CONFIG;
  switch (format) {
    case "ebay":
      return exportEbay(cards, tmpl, pc);
    case "tcgplayer":
      return exportTcgPlayer(cards, tmpl, pc);
    case "whatnot":
      return exportWhatnot(cards, tmpl, pc);
    case "shopify":
      return exportShopify(cards, tmpl, pc);
    case "squarespace":
      return exportSquarespace(cards, tmpl, pc);
    case "json":
      return {
        filename: `tcg-inventory-${stamp()}.json`,
        mimeType: "application/json",
        body: JSON.stringify(cards, null, 2)
      };
    case "csv":
    default:
      return exportGenericCsv(cards, tmpl, pc);
  }
}

// ---- Smart price helper ----
// Returns the best available price: smart-priced > user-set > market
function getSmartPrice(c: ScannedCard, pricingConfig?: PricingConfig): number {
  if (pricingConfig) {
    const result = computeListPrice(c, pricingConfig);
    if (result.listPrice > 0) return result.listPrice;
  }
  if (c.listPrice && c.listPrice > 0) return c.listPrice;
  return c.marketPriceUsd ?? 0;
}

// Collect all photo URLs for a card (user photos don't have real URLs,
// but API images and external URLs can be referenced).
function getPhotoUrls(c: ScannedCard): string[] {
  const urls: string[] = [];
  // First: the official API image
  if (c.imageUrl) urls.push(c.imageUrl);
  // Then: user-uploaded photos (data URLs — eBay can't use these directly,
  // but they're included for reference; users host them separately)
  const photos = c.photos || [];
  for (const p of photos) {
    if (p.dataUrl && !p.dataUrl.startsWith("data:") && !urls.includes(p.dataUrl)) {
      urls.push(p.dataUrl);
    }
  }
  return urls;
}

// Count user photos for display
function photoCount(c: ScannedCard): number {
  return (c.photos || []).length;
}

// ----- eBay bulk listing CSV -----
function exportEbay(cards: ScannedCard[], templates: ListingTemplate[], pc: PricingConfig): ExportResult {
  const header = [
    "Action(SiteID=US|Country=US|Currency=USD|Version=1193)",
    "Category",
    "Title",
    "ConditionID",
    "PicURL",
    "Description",
    "Format",
    "Duration",
    "StartPrice",
    "Quantity",
    "Location",
    "DispatchTimeMax",
    "ReturnsAcceptedOption",
    "ShippingService-1:Option",
    "ShippingService-1:Cost",
    "CustomLabel",
    "PhotoCount",
    "Graded",
    "GradingCompany",
    "Grade",
    "CertNumber"
  ];
  const rows = cards.map((c) => {
    const title = generateListingTitle(c, templates, "ebay").slice(0, 80); // eBay 80-char limit
    const description = generateListingDescription(c, templates, "ebay");
    const price = getSmartPrice(c, { ...pc, targetPlatform: "ebay" }).toFixed(2);
    const picUrls = getPhotoUrls(c);

    return [
      "Add",
      "183454", // CCG Individual Cards
      title,
      conditionToEbayId(c.condition, c.slabbed),
      picUrls.join("|"), // eBay accepts pipe-separated URLs
      description,
      "FixedPrice",
      "GTC",
      price,
      String(c.quantity),
      "United States",
      "1",
      "ReturnsAccepted",
      "USPSFirstClass",
      "0.99",
      c.id,
      String(photoCount(c)),
      c.slabbed ? "Yes" : "No",
      c.grading ? (GRADING_COMPANY_LABELS[c.grading.company] || "") : "",
      c.grading?.grade || "",
      c.grading?.certNumber || ""
    ];
  });
  return {
    filename: `ebay-listings-${stamp()}.csv`,
    mimeType: "text/csv",
    body: toCsv([header, ...rows])
  };
}

function conditionToEbayId(cond: ScannedCard["condition"], slabbed?: boolean): string {
  // Graded/slabbed cards use "Graded" condition on eBay (2750)
  if (slabbed) return "2750";
  switch (cond) {
    case "Near Mint":       return "4000";
    case "Lightly Played":  return "5000";
    case "Moderately Played": return "6000";
    case "Heavily Played":  return "3000";
    case "Damaged":         return "7000";
    default:                return "4000";
  }
}

// ----- TCGPlayer Seller Portal CSV -----
function exportTcgPlayer(cards: ScannedCard[], templates: ListingTemplate[], pc: PricingConfig): ExportResult {
  const header = [
    "TCGplayer Id",
    "Product Name",
    "Set Name",
    "Number",
    "Rarity",
    "Condition",
    "Market Price",
    "TCG Marketplace Price",
    "Total Quantity",
    "Add to Quantity",
    "Photo URL",
    "PhotoCount",
    "SKU",
    "Graded",
    "GradingCompany",
    "Grade",
    "CertNumber"
  ];
  const rows = cards.map((c) => {
    const productName = generateListingTitle(c, templates, "tcgplayer");
    const picUrls = getPhotoUrls(c);
    const smartPrice = getSmartPrice(c, { ...pc, targetPlatform: "tcgplayer" });
    return [
      "",
      productName,
      c.setName || "",
      c.collectorNumber || "",
      c.rarity || "",
      tcgplayerCondition(c.condition, c.foil),
      (c.marketPriceUsd ?? 0).toFixed(2),
      smartPrice.toFixed(2),
      String(c.quantity),
      String(c.quantity),
      picUrls[0] || "",
      String(photoCount(c)),
      c.sku || "",
      c.slabbed ? "Yes" : "No",
      c.grading ? (GRADING_COMPANY_LABELS[c.grading.company] || "") : "",
      c.grading?.grade || "",
      c.grading?.certNumber || ""
    ];
  });
  return {
    filename: `tcgplayer-listings-${stamp()}.csv`,
    mimeType: "text/csv",
    body: toCsv([header, ...rows])
  };
}

function tcgplayerCondition(cond: ScannedCard["condition"], foil: boolean): string {
  const base =
    cond === "Near Mint" ? "Near Mint"
    : cond === "Lightly Played" ? "Lightly Played"
    : cond === "Moderately Played" ? "Moderately Played"
    : cond === "Heavily Played" ? "Heavily Played"
    : "Damaged";
  return foil ? `${base} Foil` : base;
}

// ----- Generic CSV -----
function exportGenericCsv(cards: ScannedCard[], templates: ListingTemplate[], pc: PricingConfig): ExportResult {
  const header = [
    "id",
    "game",
    "name",
    "listingTitle",
    "setName",
    "setCode",
    "collectorNumber",
    "rarity",
    "condition",
    "foil",
    "quantity",
    "language",
    "marketPriceUsd",
    "listPrice",
    "platformFees",
    "netProfit",
    "marginPercent",
    "imageUrl",
    "externalUrl",
    "photoCount",
    "notes",
    "sku",
    "slabbed",
    "gradingCompany",
    "grade",
    "certNumber"
  ];
  const rows = cards.map((c) => {
    const smartPrice = getSmartPrice(c, pc);
    const fees = calculateFees(smartPrice, pc.targetPlatform, pc.sellerCosts);
    return [
      c.id,
      GAME_LABELS[c.game],
      c.name,
      generateListingTitle(c, templates, "generic"),
      c.setName || "",
      c.setCode || "",
      c.collectorNumber || "",
      c.rarity || "",
      c.condition,
      c.foil ? "true" : "false",
      String(c.quantity),
      c.language,
      c.marketPriceUsd != null ? c.marketPriceUsd.toFixed(2) : "",
      smartPrice.toFixed(2),
      fees.totalFees.toFixed(2),
      fees.netProfit.toFixed(2),
      fees.marginPercent.toFixed(1),
      c.imageUrl || "",
      c.externalUrl || "",
      String(photoCount(c)),
      c.notes || "",
      c.sku || "",
      c.slabbed ? "true" : "false",
      c.grading ? (GRADING_COMPANY_LABELS[c.grading.company] || "") : "",
      c.grading?.grade || "",
      c.grading?.certNumber || ""
    ];
  });
  return {
    filename: `tcg-inventory-${stamp()}.csv`,
    mimeType: "text/csv",
    body: toCsv([header, ...rows])
  };
}

// ----- Whatnot bulk listing CSV -----
function exportWhatnot(cards: ScannedCard[], templates: ListingTemplate[], pc: PricingConfig): ExportResult {
  const header = [
    "Title",
    "Description",
    "Starting Bid",
    "Buy Now Price",
    "Quantity",
    "Category",
    "Condition",
    "Photo URL",
    "Game",
    "Set",
    "Card Number",
    "Rarity",
    "Foil",
    "Language",
    "Graded",
    "Grading Company",
    "Grade",
    "Cert Number",
    "SKU"
  ];
  const rows = cards.map((c) => {
    const title = generateListingTitle(c, templates, "whatnot").slice(0, 100);
    const description = generateListingDescription(c, templates, "whatnot");
    const picUrls = getPhotoUrls(c);
    const smartPrice = getSmartPrice(c, { ...pc, targetPlatform: "whatnot" });
    return [
      title,
      description,
      smartPrice.toFixed(2),
      smartPrice.toFixed(2),
      String(c.quantity),
      "Trading Cards",
      c.slabbed ? `Graded ${c.grading?.grade || ""}`.trim() : c.condition,
      picUrls[0] || "",
      GAME_LABELS[c.game],
      c.setName || "",
      c.collectorNumber || "",
      c.rarity || "",
      c.foil ? "Yes" : "No",
      c.language,
      c.slabbed ? "Yes" : "No",
      c.grading ? (GRADING_COMPANY_LABELS[c.grading.company] || "") : "",
      c.grading?.grade || "",
      c.grading?.certNumber || "",
      c.sku || c.id
    ];
  });
  return {
    filename: `whatnot-listings-${stamp()}.csv`,
    mimeType: "text/csv",
    body: toCsv([header, ...rows])
  };
}

// ----- Shopify product CSV -----
function exportShopify(cards: ScannedCard[], templates: ListingTemplate[], pc: PricingConfig): ExportResult {
  const header = [
    "Handle",
    "Title",
    "Body (HTML)",
    "Vendor",
    "Product Category",
    "Type",
    "Tags",
    "Published",
    "Option1 Name",
    "Option1 Value",
    "Variant SKU",
    "Variant Grams",
    "Variant Inventory Tracker",
    "Variant Inventory Qty",
    "Variant Inventory Policy",
    "Variant Fulfillment Service",
    "Variant Price",
    "Variant Compare At Price",
    "Variant Requires Shipping",
    "Image Src",
    "Image Position",
    "Status"
  ];
  const rows = cards.map((c) => {
    const title = generateListingTitle(c, templates, "shopify");
    const description = generateListingDescription(c, templates, "shopify");
    const handle = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
    const picUrls = getPhotoUrls(c);
    const tags: string[] = [GAME_LABELS[c.game], c.condition];
    if (c.setName) tags.push(c.setName);
    if (c.rarity) tags.push(c.rarity);
    if (c.foil) tags.push("Foil");
    if (c.slabbed) {
      tags.push("Graded");
      if (c.grading) tags.push(GRADING_COMPANY_LABELS[c.grading.company]);
    }
    return [
      handle,
      title,
      `<p>${description.replace(/\n/g, "<br>")}</p>`,
      "SnapList",
      "Toys & Games > Collectible Card Games",
      "Trading Card",
      tags.join(", "),
      "TRUE",
      "Condition",
      c.slabbed ? `Graded ${c.grading?.company?.toUpperCase() || ""} ${c.grading?.grade || ""}`.trim() : c.condition,
      c.sku || c.id,
      "5",
      "shopify",
      String(c.quantity),
      "deny",
      "manual",
      getSmartPrice(c, { ...pc, targetPlatform: "shopify" }).toFixed(2),
      "",
      "TRUE",
      picUrls[0] || "",
      "1",
      "active"
    ];
  });
  return {
    filename: `shopify-products-${stamp()}.csv`,
    mimeType: "text/csv",
    body: toCsv([header, ...rows])
  };
}

// ----- Squarespace product CSV -----
function exportSquarespace(cards: ScannedCard[], templates: ListingTemplate[], pc: PricingConfig): ExportResult {
  const header = [
    "Title",
    "Description",
    "URL Slug",
    "Categories",
    "Tags",
    "SKU",
    "Price",
    "Stock",
    "Visible",
    "Weight",
    "Option Name 1",
    "Option Value 1",
    "Product Image 1",
    "Product Image 2"
  ];
  const rows = cards.map((c) => {
    const title = generateListingTitle(c, templates, "squarespace");
    const description = generateListingDescription(c, templates, "squarespace");
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 100);
    const picUrls = getPhotoUrls(c);
    const tags: string[] = [c.condition];
    if (c.rarity) tags.push(c.rarity);
    if (c.foil) tags.push("Foil");
    if (c.slabbed && c.grading) {
      tags.push("Graded", GRADING_COMPANY_LABELS[c.grading.company], `Grade ${c.grading.grade}`);
    }
    return [
      title,
      description,
      slug,
      `Trading Cards, ${GAME_LABELS[c.game]}`,
      tags.join(", "),
      c.sku || c.id,
      getSmartPrice(c, { ...pc, targetPlatform: "squarespace" }).toFixed(2),
      String(c.quantity),
      "Y",
      "5",
      "Condition",
      c.slabbed ? `Graded ${c.grading?.grade || ""}`.trim() : c.condition,
      picUrls[0] || "",
      picUrls[1] || ""
    ];
  });
  return {
    filename: `squarespace-products-${stamp()}.csv`,
    mimeType: "text/csv",
    body: toCsv([header, ...rows])
  };
}

// ----- CSV helpers -----
function toCsv(rows: (string | number)[][]): string {
  return rows.map((r) => r.map(csvEscape).join(",")).join("\r\n");
}

function csvEscape(v: string | number): string {
  const s = v == null ? "" : String(v);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function stamp(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
