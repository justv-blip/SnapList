"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Wrench,
  Package,
  FileSpreadsheet,
  RefreshCcw,
  Tags,
  MessageSquare,
  Layers,
  ClipboardList,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  BarChart3,
  Settings,
  Download,
  Info,
  RefreshCw,
  Webhook,
  Upload,
} from "lucide-react";
import { MarketAnalysisPanel } from "@/components/MarketAnalysis";
import { EbayRepricingTool } from "@/components/EbayRepricingTool";

type ToolTab = "ebay" | "tcgplayer" | "market";

function ToolCard({
  icon: Icon,
  title,
  description,
  status,
  action,
  onAction,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  status: "available" | "coming-soon" | "connected";
  action: string;
  onAction?: () => void;
}) {
  const isComingSoon = status === "coming-soon";
  return (
    <div className="card-panel flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
            isComingSoon
              ? "bg-panel2 border border-border"
              : "bg-accent/10 border border-accent/30"
          }`}
        >
          <Icon
            className={`w-5 h-5 ${isComingSoon ? "text-muted" : "text-accent"}`}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-sm ${isComingSoon ? "text-muted" : ""}`}>{title}</h3>
            {status === "connected" && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-green-500/10 border border-green-500/30 text-green-400">
                <CheckCircle2 className="w-3 h-3" />
                Connected
              </span>
            )}
            {isComingSoon && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-panel2 border border-border text-muted">
                On Roadmap
              </span>
            )}
          </div>
          <p className="text-xs text-muted mt-1 leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      {!isComingSoon && (
        <button
          className="btn self-start mt-auto flex items-center gap-1.5"
          onClick={onAction}
        >
          {action}
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

export default function ToolsPage() {
  const [activeTab, setActiveTab] = useState<ToolTab>("ebay");
  const [ebayConnected, setEbayConnected] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/ebay/status")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setEbayConnected(d?.connected ?? false))
      .catch(() => setEbayConnected(false));
  }, []);

  const tabs: { key: ToolTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { key: "ebay", label: "eBay Tools", icon: Package },
    { key: "tcgplayer", label: "TCGPlayer Tools", icon: FileSpreadsheet },
    { key: "market", label: "Market Analysis", icon: BarChart3 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Tools</h1>
        <p className="text-sm text-muted mt-1">
          Platform-specific tools for managing your listings and inventory
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 bg-panel2 border border-border rounded-xl w-fit">
        {tabs.map(({ key, label, icon: TabIcon }) => (
          <button
            key={key}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              activeTab === key
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-muted hover:text-white hover:bg-panel border border-transparent"
            }`}
            onClick={() => setActiveTab(key)}
          >
            <TabIcon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* eBay connection banner — only shown when not connected */}
      {activeTab === "ebay" && ebayConnected === false && (
        <div className="card-panel bg-accent/5 border-accent/20">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Connect your eBay account to get started</p>
              <p className="text-xs text-muted mt-1">
                Connect your eBay seller account once in Settings to enable direct listing.
                Once connected, you can push cards straight from the scanner — no CSV upload needed.
              </p>
              <Link href="/settings" className="btn mt-3 inline-flex items-center gap-2 text-xs">
                <Settings className="w-3.5 h-3.5" />
                Connect eBay in Settings
              </Link>
            </div>
          </div>
        </div>
      )}
      {/* eBay connected banner */}
      {activeTab === "ebay" && ebayConnected === true && (
        <div className="card-panel bg-green-500/5 border-green-500/20">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-5 h-5 text-green-400 shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-400">eBay account connected</p>
              <p className="text-xs text-muted mt-0.5">
                Your listings will sync directly — no CSV exports needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* TCGPlayer info banner */}
      {activeTab === "tcgplayer" && (
        <div className="card-panel bg-panel border-border">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-accent shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">TCGPlayer Seller Portal CSV import</p>
              <p className="text-xs text-muted mt-1">
                TCGPlayer doesn&apos;t provide a public API for third-party tools. The best workflow is
                to export your scanned cards as a TCGPlayer CSV from your Dashboard, then import the
                file directly into your TCGPlayer Seller Portal — step-by-step instructions are shown
                after each export.
              </p>
              <div className="flex gap-2 mt-3 flex-wrap">
                <Link href="/dashboard" className="btn inline-flex items-center gap-2 text-xs">
                  <Download className="w-3.5 h-3.5" />
                  Export TCGPlayer CSV
                </Link>
                <a
                  href="https://store.tcgplayer.com/admin/inventory/massentry"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn inline-flex items-center gap-2 text-xs"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Open Seller Portal
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* eBay Tools */}
      {activeTab === "ebay" && (
        <div className="space-y-4">
          {/* Live repricing tool */}
          <div className="card-panel">
            <EbayRepricingTool />
          </div>

          {/* Live eBay automation features */}
          <div className="grid gap-4 sm:grid-cols-2">
            <ToolCard
              icon={RefreshCw}
              title="Auto-Reprice"
              description="SnapList checks your active eBay listings once per day and automatically adjusts prices that deviate beyond your threshold from current market value. Configure your threshold in Settings."
              status="available"
              action="Configure in Settings"
              onAction={() => window.location.href = "/settings#auto-reprice"}
            />
            <ToolCard
              icon={Webhook}
              title="Sold Item Webhook"
              description="When an item sells on eBay, SnapList receives an instant notification and automatically deducts it from your inventory. No manual tracking — your collection stays in sync."
              status="available"
              action="View Inventory"
              onAction={() => window.location.href = "/inventories"}
            />
            <ToolCard
              icon={Upload}
              title="Bulk CSV Import"
              description="Import up to 2,000 cards at once from a spreadsheet. Drag-and-drop a CSV file on the Scan page, preview your data, and add the whole batch to your collection in one click."
              status="available"
              action="Go to Scan"
              onAction={() => window.location.href = "/scan"}
            />
            <ToolCard
              icon={Tags}
              title="Offers Management"
              description="View and respond to Best Offer submissions across all your listings. Accept, decline, or counter offers in bulk. Set auto-accept and auto-decline thresholds per listing or globally."
              status="coming-soon"
              action="Manage Offers"
            />
            <ToolCard
              icon={MessageSquare}
              title="Buyer Messaging"
              description="Centralized inbox for buyer messages across all your eBay listings. Send shipping updates, answer questions, and manage communication without switching to eBay's message center."
              status="coming-soon"
              action="Open Messages"
            />
            <ToolCard
              icon={Layers}
              title="Combine Duplicates"
              description="Detect duplicate listings across your eBay store and merge them into multi-quantity listings. Reduces listing fees and simplifies inventory management. Preview changes before applying."
              status="coming-soon"
              action="Find Duplicates"
            />
          </div>
        </div>
      )}

      {/* TCGPlayer Tools */}
      {activeTab === "tcgplayer" && (
        <div className="grid gap-4 sm:grid-cols-2">
          <ToolCard
            icon={ClipboardList}
            title="Pull Sheet Generator"
            description="Generate a pull sheet from your TCGPlayer orders, organized by your SKU system. Cards are grouped by storage location (binder, box, etc.) based on the SKU pattern you use when listing. Export as PDF or CSV for efficient order fulfillment."
            status="coming-soon"
            action="Generate Pull Sheet"
          />
          <ToolCard
            icon={RefreshCcw}
            title="Inventory Sync"
            description="Sync your scanned inventory with TCGPlayer. Automatically update quantities and pricing across your TCGPlayer store based on your latest scans and collection changes."
            status="coming-soon"
            action="Sync Inventory"
          />
          <ToolCard
            icon={Tags}
            title="Repricing Tool"
            description="Automatically reprice your TCGPlayer listings based on market data. Set rules like 'match lowest' or 'market price minus 5%' to stay competitive without constant manual updates."
            status="coming-soon"
            action="Set Pricing Rules"
          />
          <ToolCard
            icon={FileSpreadsheet}
            title="SKU Manager"
            description="Set up and manage your SKU system for TCGPlayer listings. Define SKU patterns (e.g. location-set-number) that map to your physical storage organization for faster pull sheet fulfillment."
            status="coming-soon"
            action="Manage SKUs"
          />
        </div>
      )}

      {/* Market Analysis */}
      {activeTab === "market" && (
        <div className="space-y-4">
          <div className="card-panel">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-sm">Price Trends & Buy/Hold/Sell</h3>
            </div>
            <MarketAnalysisPanel />
          </div>
          <div className="card-panel">
            <div className="flex items-center gap-2 mb-2">
              <Info className="w-4 h-4 text-accent" />
              <h3 className="font-semibold text-sm">About Market Analysis</h3>
            </div>
            <p className="text-xs text-muted leading-relaxed">
              Buy/Hold/Sell signals are generated from current market price data and our internal
              trend algorithms. These are suggestions to inform your decisions — always do your own
              research before buying or selling. Deeper price history charts and analytics are on
              our roadmap.
            </p>
          </div>
        </div>
      )}

      {/* Quick export reminder (eBay + TCGPlayer tabs) */}
      {activeTab !== "market" && (
        <div className="card-panel">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-4 h-4 text-accent" />
            <h3 className="font-semibold text-sm">Bulk Exports — Available Now</h3>
          </div>
          <p className="text-xs text-muted leading-relaxed">
            Export your scanned cards from the Dashboard in platform-ready formats for{" "}
            <span className="text-white">eBay</span>,{" "}
            <span className="text-white">TCGPlayer</span>,{" "}
            <span className="text-white">Whatnot</span>,{" "}
            <span className="text-white">Shopify</span>, and{" "}
            <span className="text-white">Squarespace</span>.
            TCGPlayer and Whatnot exports include step-by-step import instructions so you know
            exactly where to upload the file.
          </p>
        </div>
      )}
    </div>
  );
}
