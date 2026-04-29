import {
  Camera,
  Upload,
  ScanLine,
  FileSpreadsheet,
  Layers,
  ImageIcon,
  Zap,
  HelpCircle,
} from "lucide-react";

const SECTIONS = [
  {
    icon: ScanLine,
    title: "Getting Started",
    content:
      "SnapList identifies your trading cards using AI vision. You can upload photos from your computer or use the live camera on your phone. The app works with Pokémon, Magic: The Gathering, Yu-Gi-Oh!, One Piece, Digimon, Disney Lorcana, and many more games.",
  },
  {
    icon: Upload,
    title: "Uploading Photos",
    content:
      'Go to the Scan tab and use the "Upload" mode. Drag and drop your card photos or click to browse. You can upload multiple cards at once — just select all your photos. Front and back images are automatically detected and paired into a single listing.',
  },
  {
    icon: Camera,
    title: "Using the Camera",
    content:
      'Switch to "Camera" mode in the Scan tab. Point your phone\'s camera at a card and tap the shutter button. The rear camera is used by default. A card-shaped guide overlay helps you frame the shot. Each capture is sent through the same AI identification pipeline as uploads.',
  },
  {
    icon: ImageIcon,
    title: "Multi-Photo Listings",
    content:
      "Each card listing supports multiple photos: a front photo (used for identification), a back photo (shows card condition), and extra photos for close-ups on centering, edges, or special features. You can add or remove photos at any time from the card row.",
  },
  {
    icon: Zap,
    title: "AI Identification",
    content:
      "When you upload or capture a card, Claude Vision reads the card name, set code, collector number, and game directly from the image. The app then looks up the card in game-specific databases to pull official art, set info, rarity, and market pricing.",
  },
  {
    icon: Layers,
    title: "Reviewing & Editing",
    content:
      "After scanning, review each card in the list. You can edit the name, set, condition, price, quantity, and more. Click \"Lookup\" to re-search the database if you've corrected a field. Use the expanded details to set rarity, language, and custom listing titles.",
  },
  {
    icon: FileSpreadsheet,
    title: "Exporting & Listing",
    content:
      "When your batch is ready, use the export buttons to download platform-ready files. eBay CSV uses the File Exchange format. TCGPlayer CSV matches the Seller Portal import format. You can also export generic CSV or JSON. Listing templates control the title and description for each platform — customize them in the Listing Templates section below the card list.",
  },
  {
    icon: HelpCircle,
    title: "Tips & Troubleshooting",
    content:
      "For best results, photograph cards on a solid dark background with even lighting. Avoid glare on foil cards. If vision can't identify a card, you can enter the name manually and click Lookup. If the API lookup comes back empty, double-check the set code and collector number — these are the most important fields for an exact match.",
  },
];

export default function GuidePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Guide</h1>
        <p className="text-sm text-muted mt-1">
          Learn how to scan, organize, and list your cards
        </p>
      </div>

      <div className="space-y-4">
        {SECTIONS.map((section) => (
          <div key={section.title} className="card-panel">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center shrink-0 mt-0.5">
                <section.icon className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h2 className="font-semibold mb-2">{section.title}</h2>
                <p className="text-sm text-muted leading-relaxed">
                  {section.content}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
