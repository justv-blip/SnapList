"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Sparkles,
  LayoutDashboard,
  ScanLine,
  Library,
  Settings,
  BookOpen,
  Home,
  Mail,
  Share2,
  ChevronLeft,
  ChevronRight,
  FileSliders,
  LogOut,
  User,
  Wrench,
  ArrowLeftRight,
  Warehouse,
  Gift,
} from "lucide-react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
}

// ── Menu: core pages ──
const MENU_NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/templates", label: "Templates", icon: FileSliders },
  { href: "/collection", label: "Collection", icon: Library },
];

// ── Tools: feature tools ──
const TOOLS_NAV: NavItem[] = [
  { href: "/tools", label: "Tools", icon: Wrench },
  { href: "/trade", label: "Trade Analyzer", icon: ArrowLeftRight },
  { href: "/inventories", label: "Inventories", icon: Warehouse },
];

// ── Options: settings & extras ──
const OPTIONS_NAV: NavItem[] = [
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/guide", label: "Guide", icon: BookOpen },
  { href: "/earn-credits", label: "Earn Credits", icon: Gift },
];

const FOOTER_NAV: NavItem[] = [
  { href: "/", label: "Home", icon: Home },
  { href: "/contact", label: "Contact", icon: Mail },
  { href: "/socials", label: "Socials", icon: Share2 },
];

interface UserInfo {
  email: string;
  displayName: string;
  avatarUrl?: string;
  tier: string;
}

export default function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: authUser } }) => {
      if (authUser) {
        // Fetch profile for tier info
        supabase
          .from("profiles")
          .select("display_name, subscription_tier, avatar_url")
          .eq("id", authUser.id)
          .single()
          .then(({ data: profile }) => {
            setUser({
              email: authUser.email || "",
              displayName: profile?.display_name || authUser.email?.split("@")[0] || "User",
              avatarUrl: profile?.avatar_url,
              tier: profile?.subscription_tier || "free",
            });
          });
      }
    });
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <>
      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-panel border-b border-border px-4 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/10 border border-accent/30 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-accent" />
          </div>
          <span className="font-semibold text-sm">SnapList</span>
        </Link>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-panel border-t border-border flex items-center justify-around px-2 pb-1 pt-1 safe-bottom">
        {/* Left group: Dashboard, Collection */}
        {[MENU_NAV[0], MENU_NAV[3]].map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-[10px] font-medium transition-colors ${
                active ? "text-accent" : "text-muted hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}

        {/* Centre FAB — Scan */}
        <Link
          href="/scan"
          className={`flex flex-col items-center gap-0.5 -mt-5 transition-all ${
            pathname.startsWith("/scan")
              ? "opacity-100"
              : "opacity-90 hover:opacity-100"
          }`}
        >
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg shadow-accent/30 transition-colors ${
              pathname.startsWith("/scan")
                ? "bg-accent scale-105"
                : "bg-accent hover:bg-accent/90"
            }`}
          >
            <ScanLine className="w-6 h-6 text-black" />
          </div>
          <span className={`text-[10px] font-semibold mt-0.5 ${pathname.startsWith("/scan") ? "text-accent" : "text-muted"}`}>
            Scan
          </span>
        </Link>

        {/* Right group: Tools, Settings */}
        {[TOOLS_NAV[0], OPTIONS_NAV[0]].map((item) => {
          const active = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg text-[10px] font-medium transition-colors ${
                active ? "text-accent" : "text-muted hover:text-white"
              }`}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Desktop sidebar */}
      <aside
        className={`hidden lg:flex flex-col fixed top-0 left-0 h-screen bg-panel border-r border-border z-40 transition-all duration-200 ${
          collapsed ? "w-[68px]" : "w-60"
        }`}
      >
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-3">
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-accent/10 border border-accent/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4.5 h-4.5 text-accent" />
            </div>
            {!collapsed && (
              <span className="font-semibold tracking-tight truncate">
                SnapList
              </span>
            )}
          </Link>
        </div>

        {/* Nav sections */}
        <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          {!collapsed && <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">Menu</div>}
          <NavSection items={MENU_NAV} pathname={pathname} collapsed={collapsed} />

          <div className="my-3 border-t border-border" />

          {!collapsed && <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">Tools</div>}
          <NavSection items={TOOLS_NAV} pathname={pathname} collapsed={collapsed} />

          <div className="my-3 border-t border-border" />

          {!collapsed && <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-muted">Options</div>}
          <NavSection items={OPTIONS_NAV} pathname={pathname} collapsed={collapsed} />
        </div>

        {/* Footer nav */}
        <div className="px-3 py-3 border-t border-border space-y-1">
          <NavSection items={FOOTER_NAV} pathname={pathname} collapsed={collapsed} />

          {/* Legal links */}
          {!collapsed && (
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 px-3 mt-2 text-[10px] text-muted">
              <Link href="/terms" className="hover:text-white transition-colors">Terms</Link>
              <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
              <Link href="/acceptable-use" className="hover:text-white transition-colors">Acceptable Use</Link>
            </div>
          )}

          {/* User account section */}
          {user && (
            <div className={`mt-2 pt-2 border-t border-border ${collapsed ? "text-center" : ""}`}>
              <div className={`flex items-center gap-3 px-3 py-2 ${collapsed ? "justify-center" : ""}`}>
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt=""
                    className="w-7 h-7 rounded-full shrink-0"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-accent/15 border border-accent/30 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-accent" />
                  </div>
                )}
                {!collapsed && (
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{user.displayName}</p>
                    <p className="text-[10px] text-muted truncate">{user.email}</p>
                  </div>
                )}
              </div>
              {!collapsed && (
                <div className="flex items-center gap-2 px-3 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${
                    user.tier === "free"
                      ? "bg-panel2 border-border text-muted"
                      : "bg-accent/10 border-accent/30 text-accent"
                  }`}>
                    {user.tier === "free" ? "Free Trial" : user.tier.charAt(0).toUpperCase() + user.tier.slice(1)}
                  </span>
                </div>
              )}
              <button
                onClick={handleSignOut}
                className={`w-full flex items-center gap-3 px-3 py-2 mt-1 rounded-lg text-xs text-muted hover:text-danger hover:bg-danger/10 transition-colors ${
                  collapsed ? "justify-center" : ""
                }`}
                title="Sign out"
              >
                <LogOut className="w-4 h-4 shrink-0" />
                {!collapsed && <span>Sign out</span>}
              </button>
            </div>
          )}

          {/* Collapse toggle */}
          <button
            onClick={() => setCollapsed((v) => !v)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs text-muted hover:text-white hover:bg-panel2 transition-colors ${
              collapsed ? "justify-center" : ""
            }`}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronLeft className="w-4 h-4" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
}

function NavSection({
  items,
  pathname,
  collapsed,
}: {
  items: NavItem[];
  pathname: string;
  collapsed: boolean;
}) {
  return (
    <>
      {items.map((item) => {
        const active = item.href === "/"
          ? pathname === "/"
          : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              active
                ? "bg-accent/10 text-accent border border-accent/20"
                : "text-muted hover:text-white hover:bg-panel2 border border-transparent"
            } ${collapsed ? "justify-center" : ""}`}
            title={collapsed ? item.label : undefined}
          >
            <item.icon className="w-4.5 h-4.5 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );
      })}
    </>
  );
}
