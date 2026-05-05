import Link from "next/link";
import {
  Sparkles,
  Camera,
  Upload,
  FileSpreadsheet,
  Layers,
  Zap,
  Shield,
  ArrowRight,
  Star,
  Check,
  X,
  Clock,
  ChevronDown,
  Timer,
  DollarSign,
  TrendingUp,
  Users,
  Gift,
  BarChart3,
  ScanLine,
  Cpu,
  Globe,
} from "lucide-react";
import { PricingSection } from "@/components/PricingSection";

// ── Data ──

const SUPPORTED_GAMES = [
  "Pokémon",
  "Magic: The Gathering",
  "Yu-Gi-Oh!",
  "One Piece",
  "Digimon",
  "Disney Lorcana",
  "Dragon Ball Super",
  "Flesh and Blood",
  "Weiss Schwarz",
  "Final Fantasy TCG",
  "Sports Cards",
  "And more…",
];

const FEATURES = [
  {
    icon: Camera,
    title: "Scan or Upload",
    description:
      "Use your phone camera for instant scanning or upload photos from your computer. Front and back photos are automatically paired.",
  },
  {
    icon: Cpu,
    title: "AI-Powered ID",
    description:
      "Claude vision reads card names, set codes, and collector numbers directly from the image — no manual typing required.",
  },
  {
    icon: Layers,
    title: "Multi-Photo Listings",
    description:
      "Attach front, back, and extra photos to each card. Show buyers exactly what they're getting with every listing.",
  },
  {
    icon: FileSpreadsheet,
    title: "Export Anywhere",
    description:
      "One-click export to eBay, TCGPlayer, Whatnot, Shopify, Squarespace, CSV, or JSON. Platform-ready in seconds.",
  },
  {
    icon: DollarSign,
    title: "Smart Pricing",
    description:
      "AI-powered pricing engine suggests optimal list prices based on market data, condition, and your custom rules.",
  },
  {
    icon: BarChart3,
    title: "Decision Engine",
    description:
      "Get AI buy/hold/sell/grade recommendations for every card based on market trends, condition, and rarity signals.",
  },
  {
    icon: Star,
    title: "Custom Templates",
    description:
      "Build reusable title and description patterns per platform and per game. Preview listings live before exporting.",
  },
  {
    icon: Globe,
    title: "Multi-Language",
    description:
      "Identifies cards in any language — Japanese, Korean, Chinese, German, French, and more. Provides English names automatically.",
  },
  {
    icon: Shield,
    title: "Works on Mobile",
    description:
      "Install as a standalone PWA on your phone or tablet. Scan at events, at the shop, or on the go — no app store needed.",
  },
];

const STEPS = [
  {
    step: "1",
    icon: Upload,
    title: "Upload or Scan",
    text: "Drop photos or use the live camera. Fronts and backs are paired automatically.",
  },
  {
    step: "2",
    icon: Zap,
    title: "AI Identifies",
    text: "Vision reads the card, then we look it up across 6+ TCG APIs for full data and market pricing.",
  },
  {
    step: "3",
    icon: FileSpreadsheet,
    title: "Export & List",
    text: "Review your inventory, apply templates, and download platform-ready CSVs. One batch, every marketplace.",
  },
];

const COMPARISON = [
  { task: "Identify a card", manual: "30–60 sec", scanner: "2–3 sec" },
  { task: "Look up market price", manual: "30 sec", scanner: "Automatic" },
  { task: "Type listing title", manual: "20 sec", scanner: "Auto-generated" },
  { task: "Write description", manual: "30 sec", scanner: "Template-based" },
  { task: "100-card batch", manual: "~3 hours", scanner: "~15 minutes" },
];

const FAQ = [
  {
    q: "What TCG games do you support?",
    a: "We support Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Digimon, Disney Lorcana, Dragon Ball Super, Flesh and Blood, Weiss Schwarz, Final Fantasy TCG, sports cards, and more. The AI can identify cards from virtually any game, and we have dedicated API integrations for the six most popular games.",
  },
  {
    q: "How accurate is the AI identification?",
    a: "Our AI correctly identifies the card name, set, and collector number in the vast majority of cases for cards in good condition with clear photos. We always show a confidence score and encourage you to verify before listing — you're in control.",
  },
  {
    q: "Can I use this on my phone?",
    a: "Yes! SnapList is a Progressive Web App (PWA). You can install it directly to your home screen on iOS or Android and use the live camera to scan cards. No app store needed.",
  },
  {
    q: "What export formats are supported?",
    a: "We export to eBay File Exchange CSV, TCGPlayer Seller Portal CSV, Whatnot, Shopify, Squarespace, generic CSV, and JSON. Each format is tailored to the platform's required columns. You can also build custom listing templates for titles and descriptions.",
  },
  {
    q: "Do I need to pay to try it?",
    a: "No. The free plan gives you 25 scans per month forever — no credit card required, no expiry. Paid plans start at $12/month.",
  },
  {
    q: "How is this different from other listing tools?",
    a: "SnapList uses AI vision to identify cards from photos, so you don't have to type names or search catalogs. We support multi-photo listings (front + back), custom description templates, smart pricing, decision engine recommendations, and export to 7 platforms from a single inventory. It's designed to be faster for sellers who photograph their cards.",
  },
];

// ── Page ──

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-xl border-b border-border/50">
        <div className="max-w-6xl w-full mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center">
              <Sparkles className="w-4.5 h-4.5 text-accent" />
            </div>
            <span className="text-lg font-semibold tracking-tight">SnapList</span>
          </div>
          <div className="flex items-center gap-6">
            <div className="hidden md:flex items-center gap-5 text-sm text-muted">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#reviews" className="hover:text-foreground transition-colors">Reviews</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
              <Link href="/socials" className="hover:text-foreground transition-colors">Socials</Link>
            </div>
            <Link href="/login" className="btn text-sm">Log in</Link>
            <Link href="/login" className="btn-primary text-sm hidden sm:inline-flex">
              Get Started
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-accent/[0.07] rounded-full blur-[120px]" />
          <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-accent2/[0.04] rounded-full blur-[100px]" />
        </div>

        <div className="max-w-6xl mx-auto px-5 pt-24 pb-28 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/25 text-accent text-sm font-medium mb-8">
            <Zap className="w-3.5 h-3.5" />
            AI-powered card scanning and listing
          </div>
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.08] max-w-4xl mx-auto">
            Scan your cards.
            <br />
            <span className="text-accent">List them everywhere.</span>
          </h1>
          <p className="mt-7 text-lg sm:text-xl text-muted max-w-2xl mx-auto leading-relaxed">
            Point your camera at any trading card. Get an instant ID with set,
            collector number, and market price. Export ready-to-list files for eBay,
            TCGPlayer, and more — in seconds, not hours.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4 flex-wrap">
            <Link href="/login" className="btn-primary text-base px-8 py-3.5 shadow-lg shadow-accent/20">
              Start Scanning Free
              <ArrowRight className="w-4 h-4" />
            </Link>
            <a href="#how-it-works" className="btn text-base px-8 py-3.5">
              See How It Works
            </a>
          </div>

          {/* Trust indicators */}
          <div className="mt-10 flex items-center justify-center gap-6 sm:gap-8 text-sm text-muted flex-wrap">
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-accent2" />
              No credit card required
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-accent2" />
              25 free scans
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="w-4 h-4 text-accent2" />
              Works on mobile
            </span>
          </div>

          {/* ── Product UI Mockup ── */}
          <div className="mt-14 max-w-2xl mx-auto">
            {/* Browser-style chrome */}
            <div className="rounded-2xl border border-border/60 bg-panel overflow-hidden shadow-2xl shadow-black/40">
              {/* Top bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-panel2">
                <div className="w-3 h-3 rounded-full bg-danger/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
                <div className="w-3 h-3 rounded-full bg-accent2/70" />
                <div className="flex-1 mx-3">
                  <div className="bg-bg rounded-md px-3 py-1 text-[11px] text-muted flex items-center gap-2">
                    <ScanLine className="w-3 h-3 text-accent shrink-0" />
                    snaplist.app/scan
                  </div>
                </div>
              </div>

              {/* Scan result card */}
              <div className="p-5 space-y-3">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-accent2 animate-pulse" />
                    <span className="text-xs font-medium text-accent2">Identified</span>
                  </div>
                  <span className="text-[10px] text-muted border border-border rounded-full px-2 py-0.5">
                    97% confidence
                  </span>
                </div>

                {/* Card details row */}
                <div className="flex gap-4 items-start">
                  {/* Card image — Charizard VMAX (Shining Fates Shiny Vault SV107) */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="https://images.pokemontcg.io/swsh45sv/SV107_hires.png"
                    alt="Charizard VMAX - Shining Fates SV107"
                    className="rounded-lg shrink-0 border border-border/60 object-cover"
                    style={{ height: "88px", width: "63px" }}
                  />

                  {/* Card info */}
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <div className="text-sm font-bold truncate">Charizard VMAX</div>
                      <div className="text-xs text-muted mt-0.5">Shining Fates &middot; SV107/SV122 &middot; Secret Rare</div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="chip text-[10px]">Pokémon</span>
                      <span className="chip text-[10px]">Near Mint</span>
                      <span className="chip text-[10px]">English</span>
                    </div>
                    <div className="flex items-center gap-3 pt-0.5">
                      <div>
                        <div className="text-[10px] text-muted">Market Price</div>
                        <div className="text-base font-bold text-accent2">$89.99</div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-accent2 font-medium">
                        <TrendingUp className="w-3 h-3" />
                        +12% this week
                      </div>
                    </div>
                  </div>

                  {/* Decision badge */}
                  <div className="shrink-0 flex flex-col items-end gap-1">
                    <div className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-accent2/15 border border-accent2/30 text-accent2">
                      SELL MAX
                    </div>
                    <div className="text-[9px] text-muted">AI Rec.</div>
                  </div>
                </div>

                {/* Action bar */}
                <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                  <div className="flex-1 h-1.5 rounded-full bg-panel2 border border-border/50 overflow-hidden">
                    <div className="h-full w-[72%] rounded-full bg-accent" />
                  </div>
                  <span className="text-[10px] text-muted shrink-0">
                    <span className="font-medium text-foreground">36</span>/50 batch scans
                  </span>
                  <div className="flex gap-1.5 shrink-0">
                    <div className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-accent/10 border border-accent/25 text-accent cursor-pointer hover:bg-accent/15 transition-colors">
                      Add to Batch
                    </div>
                    <div className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-panel2 border border-border text-muted cursor-pointer hover:bg-panel transition-colors">
                      Market Data
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Caption below mockup */}
            <p className="text-center text-xs text-muted mt-3">
              AI identifies card name, set, and market price in under 3 seconds
            </p>
          </div>

          {/* Game chips */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 max-w-2xl mx-auto">
            {SUPPORTED_GAMES.map((game) => (
              <span key={game} className="chip text-xs">
                {game}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border/50 bg-panel/50">
        <div className="max-w-6xl mx-auto px-5 py-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Layers className="w-5 h-5 text-accent" />
                <span className="text-3xl font-bold">6+</span>
              </div>
              <p className="text-sm text-muted">TCG APIs integrated</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Timer className="w-5 h-5 text-accent" />
                <span className="text-3xl font-bold">3 sec</span>
              </div>
              <p className="text-sm text-muted">Average ID time</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <FileSpreadsheet className="w-5 h-5 text-accent" />
                <span className="text-3xl font-bold">7</span>
              </div>
              <p className="text-sm text-muted">Export formats</p>
            </div>
            <div>
              <div className="flex items-center justify-center gap-2 mb-1">
                <Globe className="w-5 h-5 text-accent" />
                <span className="text-3xl font-bold">10+</span>
              </div>
              <p className="text-sm text-muted">Languages supported</p>
            </div>
          </div>
        </div>
      </section>

      {/* Speed comparison */}
      <section className="max-w-6xl mx-auto px-5 py-20">
        <div className="card-panel max-w-3xl mx-auto overflow-hidden">
          <h2 className="text-xl font-bold text-center mb-2">Stop listing cards the slow way</h2>
          <p className="text-sm text-muted text-center mb-8">
            See how SnapList compares to manual listing
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-4 text-xs text-muted uppercase tracking-wider font-medium">Task</th>
                  <th className="text-center py-3 px-4 text-xs text-muted uppercase tracking-wider font-medium">Manual</th>
                  <th className="text-center py-3 px-4 text-xs text-accent uppercase tracking-wider font-medium">SnapList</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr key={row.task} className="border-b border-border/50 last:border-0">
                    <td className="py-3 px-4 text-muted">{row.task}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 text-muted/70">
                        <Clock className="w-3.5 h-3.5" />
                        {row.manual}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-flex items-center gap-1.5 text-accent2 font-medium">
                        <Zap className="w-3.5 h-3.5" />
                        {row.scanner}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="text-center text-2xl sm:text-3xl font-bold mb-3">How it works</h2>
        <p className="text-center text-sm text-muted mb-14 max-w-lg mx-auto">
          Three steps from a pile of cards to live marketplace listings
        </p>
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((item, i) => (
            <div key={item.step} className="card-panel text-center relative">
              {i < STEPS.length - 1 && (
                <div className="hidden sm:block absolute top-1/2 -right-3 w-6 text-center">
                  <ArrowRight className="w-4 h-4 text-border" />
                </div>
              )}
              <div className="w-14 h-14 rounded-2xl bg-accent/10 border border-accent/30 flex items-center justify-center mx-auto mb-5">
                <item.icon className="w-7 h-7 text-accent" />
              </div>
              <div className="text-[10px] text-accent font-semibold uppercase tracking-widest mb-2">
                Step {item.step}
              </div>
              <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
              <p className="text-sm text-muted leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features grid */}
      <section id="features" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/[0.04] rounded-full blur-[100px]" />
        </div>
        <div className="max-w-6xl mx-auto px-5 py-20">
          <h2 className="text-center text-2xl sm:text-3xl font-bold mb-3">Everything you need to list faster</h2>
          <p className="text-center text-sm text-muted mb-14 max-w-lg mx-auto">
            Built for TCG sellers who photograph their cards
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="card-panel group hover:border-accent/30 transition-all hover:shadow-lg hover:shadow-accent/5"
              >
                <div className="w-11 h-11 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center mb-4 group-hover:bg-accent/15 transition-colors">
                  <f.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="font-semibold mb-2">{f.title}</h3>
                <p className="text-sm text-muted leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free Trial callout */}
      <section className="max-w-6xl mx-auto px-5 py-10">
        <div className="relative overflow-hidden card-panel max-w-3xl mx-auto text-center py-12 border-accent/20">
          <div className="absolute inset-0 -z-10 bg-accent/[0.03]" />
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/25 text-accent text-xs font-medium mb-4">
            <Gift className="w-3 h-3" />
            Free Trial — No Credit Card
          </div>
          <h3 className="text-xl sm:text-2xl font-bold">Try SnapList free</h3>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto leading-relaxed">
            25 free scans every month, forever. No credit card, no expiry.
            Explore every feature before you commit.
          </p>
          <Link href="/login" className="btn-primary mt-6 text-sm shadow-lg shadow-accent/20">
            Start Free Trial
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="max-w-6xl mx-auto px-5 py-20">
        <h2 className="text-center text-2xl sm:text-3xl font-bold mb-3">Simple, transparent pricing</h2>
        <p className="text-center text-sm text-muted mb-4 max-w-lg mx-auto">
          Choose the plan that fits your volume. Cancel anytime.
        </p>
        <PricingSection />
      </section>

      {/* Reviews */}
      <section id="reviews" className="relative overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-1/2 left-1/3 w-[400px] h-[400px] bg-accent/[0.04] rounded-full blur-[100px]" />
        </div>
        <div className="max-w-6xl mx-auto px-5 py-20">
          <h2 className="text-center text-2xl sm:text-3xl font-bold mb-3">What sellers are saying</h2>
          <p className="text-center text-sm text-muted mb-12 max-w-lg mx-auto">
            Join thousands of TCG sellers who scan and list faster
          </p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              {
                name: "Jake M.",
                role: "eBay Pokémon Seller",
                text: "I used to spend 3+ hours listing 100 cards. Now I scan the whole stack and export to eBay in under 20 minutes. Total game changer.",
                stars: 5,
              },
              {
                name: "Sarah L.",
                role: "LGS Owner",
                text: "The AI identification is shockingly accurate, even for Japanese cards. The multi-photo listings give my buyers confidence and I get fewer returns.",
                stars: 5,
              },
              {
                name: "Marcus T.",
                role: "TCGPlayer Pro Seller",
                text: "Smart pricing alone paid for the subscription in the first week. I was leaving money on the table with my old manual process.",
                stars: 5,
              },
            ].map((review) => (
              <div key={review.name} className="card-panel hover:border-accent/20 transition-colors">
                <div className="flex gap-0.5 mb-3">
                  {Array.from({ length: review.stars }).map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-accent text-accent" />
                  ))}
                </div>
                <p className="text-sm text-muted leading-relaxed mb-4">&ldquo;{review.text}&rdquo;</p>
                <div>
                  <p className="text-sm font-medium">{review.name}</p>
                  <p className="text-xs text-muted">{review.role}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="max-w-3xl mx-auto px-5 py-20">
        <h2 className="text-center text-2xl sm:text-3xl font-bold mb-3">Frequently asked questions</h2>
        <p className="text-center text-sm text-muted mb-12">
          Everything you need to know before getting started
        </p>
        <div className="space-y-3">
          {FAQ.map((item) => (
            <details
              key={item.q}
              className="card-panel group cursor-pointer [&[open]]:bg-accent/[0.02] [&[open]]:border-accent/20 transition-colors"
            >
              <summary className="flex items-center justify-between gap-4 font-medium text-sm list-none [&::-webkit-details-marker]:hidden">
                {item.q}
                <ChevronDown className="w-4 h-4 text-muted shrink-0 transition-transform group-open:rotate-180" />
              </summary>
              <p className="text-sm text-muted leading-relaxed mt-3 pr-8">
                {item.a}
              </p>
            </details>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-6xl mx-auto px-5 py-20 text-center">
        <div className="relative overflow-hidden card-panel max-w-2xl mx-auto py-16 border-accent/20">
          <div className="absolute inset-0 -z-10 bg-accent/[0.03]" />
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-accent/[0.08] rounded-full blur-[80px] -z-10" />
          <ScanLine className="w-10 h-10 text-accent mx-auto mb-5" />
          <h2 className="text-2xl sm:text-3xl font-bold mb-3">Ready to list faster?</h2>
          <p className="text-muted mb-8 max-w-md mx-auto leading-relaxed">
            Stop typing card names one by one. Scan your stack, review, and
            export — all in one place. Start with 25 free scans.
          </p>
          <Link href="/login" className="btn-primary text-base px-8 py-3.5 shadow-lg shadow-accent/20">
            Start Scanning Free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <p className="text-xs text-muted mt-4">
            No credit card required
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border">
        <div className="max-w-6xl mx-auto px-5 py-10">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2 text-sm">
              <Sparkles className="w-4 h-4 text-accent" />
              <span className="font-medium">SnapList</span>
              <span className="text-xs text-muted ml-2">&copy; {new Date().getFullYear()}</span>
            </div>
            <div className="flex items-center gap-5 text-xs text-muted">
              <a href="#features" className="hover:text-foreground transition-colors">Features</a>
              <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
              <a href="#faq" className="hover:text-foreground transition-colors">FAQ</a>
              <Link href="/contact" className="hover:text-foreground transition-colors">Contact</Link>
              <Link href="/socials" className="hover:text-foreground transition-colors">Socials</Link>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted">
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/acceptable-use" className="hover:text-foreground transition-colors">Acceptable Use</Link>
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
