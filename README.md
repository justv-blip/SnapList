# TCG Scanner

A web app that scans photos of trading card game cards, identifies them with
Claude's vision API, enriches each with real data from public TCG APIs, and
exports your inventory in formats ready for eBay, TCGPlayer, or your own use.

Think TCG Automate / Collectr / TCGPlayer Scan, but open source and running on
your own machine.

## Features

- **Hybrid identification** — photo → Claude vision → real API lookup, with
  manual entry as a fallback and a mock catalog as a last resort.
- **Broad TCG support**
  - Full identification + pricing: **Pokémon** (pokemontcg.io),
    **Magic: The Gathering** (Scryfall), **Yu-Gi-Oh!** (YGOPRODeck).
  - Manual entry with editable defaults: **One Piece**, **Gundam**,
    **Cardfight!! Vanguard**, **Sports cards**, **Other**.
- **Editable inventory** — name, set, number, rarity, condition, quantity,
  foil, language, notes, market price.
- **Exports** to:
  - eBay bulk-listing CSV (File Exchange format)
  - TCGPlayer Seller Portal CSV
  - Generic CSV
  - JSON

## Getting started

### 1. Install dependencies

```bash
cd tcg-scanner
npm install
```

### 2. Add your Anthropic API key (for vision)

```bash
cp .env.local.example .env.local
```

Open `.env.local` and paste your key:

```
ANTHROPIC_API_KEY=sk-ant-api03-xxxxxxxxxxxxxxxxxxxx
```

**How to get one:**

1. Go to [console.anthropic.com](https://console.anthropic.com).
2. Sign in (or create an account).
3. Click **Settings → API Keys → Create Key**.
4. Copy the key (starts with `sk-ant-api03-…`) and paste it into `.env.local`.
5. Add a payment method under **Billing**. Vision calls cost roughly
   $0.003–$0.015 per card scan depending on image size.

`.env.local` is gitignored and never committed. The key is only read by the
backend at runtime — it never touches the browser.

If you skip this step, the app still runs: scans fall back to manual entry.

**Optional:** Add `POKEMON_TCG_API_KEY` to raise Pokémon TCG API rate limits
(get a free one at [dev.pokemontcg.io](https://dev.pokemontcg.io)).

### 3. Run the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## How it works

1. You drop one or more card photos into the uploader.
2. The backend sends each image to Claude vision with a prompt asking for
   game, name, set code, collector number, and a confidence score.
3. If confidence ≥ 0.45, the app looks up the card in the real TCG API for
   that game and fills in set, rarity, image, and market price.
4. Low-confidence or unsupported-game scans drop into an editable row where
   you can type the name and hit **Lookup** to retry.
5. You can edit every field before exporting.

## Project structure

```
tcg-scanner/
├── app/
│   ├── api/
│   │   ├── scan/route.ts     # POST images → vision → lookup
│   │   ├── lookup/route.ts   # POST {game,name} → TCG API lookup
│   │   └── export/route.ts   # POST cards + format → download
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── Scanner.tsx           # Main state container
│   ├── UploadDropzone.tsx
│   ├── CardList.tsx
│   ├── CardRow.tsx           # Inline-editable card row
│   └── ExportBar.tsx
├── lib/
│   ├── types.ts
│   ├── vision.ts             # Claude vision integration
│   ├── tcgApis.ts            # Scryfall, PokemonTCG, YGOPRODeck
│   ├── mockCatalog.ts        # Fallback catalog for niche TCGs
│   └── exporters.ts          # eBay / TCGPlayer / CSV / JSON
├── package.json
├── next.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── .env.local.example
```

## Going to production

When you're ready to publish or charge for it, Next.js makes this path clean:

- **Hosting:** deploy to [Vercel](https://vercel.com) with one click; put your
  `ANTHROPIC_API_KEY` and `POKEMON_TCG_API_KEY` in the project's environment
  variables settings (never commit them to git).
- **Auth:** add [NextAuth.js](https://next-auth.js.org) or
  [Clerk](https://clerk.com) — both work with Next.js App Router.
- **Subscriptions:** add [Stripe](https://stripe.com/docs/payments/checkout)
  and gate the `/api/scan` route on a `user.plan === "paid"` check.
- **Persistence:** add [Supabase](https://supabase.com) or
  [Neon](https://neon.tech) to store a user's scanned inventory across devices
  (currently it lives only in browser state).

## Notes on the exports

- **eBay CSV** uses eBay File Exchange format, category `183454` (CCG
  Individual Cards). You may need to adjust the category and add your own
  shipping, returns, and location info before uploading.
- **TCGPlayer CSV** matches the bulk upload format of the Seller Portal.
  Their system needs the TCGPlayer Product ID for the best match — fill that
  in by hand after export if you want it auto-linked.
- Cards identified through the **mock catalog** (Gundam, Vanguard, etc.) will
  export with no set code or price unless you fill them in. That's expected —
  no free public price API exists for those games.
