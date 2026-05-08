import { Metadata } from "next";
import Link from "next/link";
import { ScanLine, Award, ImageIcon, ExternalLink } from "lucide-react";

interface ShareData {
  displayName: string;
  memberSince: number;
  totalCards: number;
  totalValue: number;
  gameBreakdown: { game: string; count: number; value: number }[];
  topCards: {
    name: string;
    game: string;
    setName: string | null;
    condition: string;
    value: number;
    foil: boolean;
    slabbed: boolean;
    imageUrl: string | null;
  }[];
}

async function getShareData(userId: string): Promise<ShareData | null> {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://snaplist.gg";
  try {
    const res = await fetch(`${baseUrl}/api/share/${userId}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return null;
    return res.json() as Promise<ShareData>;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ userId: string }>;
}): Promise<Metadata> {
  const { userId } = await params;
  const data = await getShareData(userId);
  if (!data) return { title: "Collection not found — SnapList" };
  return {
    title: `${data.displayName}'s Collection — SnapList`,
    description: `${data.totalCards} cards · $${data.totalValue.toFixed(0)} estimated value`,
    openGraph: {
      title: `${data.displayName}'s TCG Collection`,
      description: `${data.totalCards} cards valued at $${data.totalValue.toFixed(0)} — tracked with SnapList`,
      siteName: "SnapList",
    },
  };
}

export default async function SharePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const data = await getShareData(userId);

  if (!data) {
    return (
      <div className="min-h-screen bg-[#0e0e14] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-white text-lg font-semibold mb-2">Collection not found</p>
          <p className="text-gray-400 text-sm mb-6">
            This share link may have expired or doesn&apos;t exist.
          </p>
          <Link
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#7c6ef3] text-white text-sm font-medium hover:bg-[#6b5de2] transition-colors"
          >
            Go to SnapList
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0e0e14] text-white">
      {/* Top nav */}
      <nav className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <div className="w-7 h-7 rounded-lg bg-[#7c6ef3] flex items-center justify-center">
            <ScanLine className="w-4 h-4 text-white" />
          </div>
          SnapList
        </Link>
        <Link
          href="/login"
          className="px-4 py-1.5 rounded-lg border border-white/20 text-sm hover:bg-white/5 transition-colors"
        >
          Start free →
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-[#7c6ef3]/20 border border-[#7c6ef3]/30 flex items-center justify-center text-2xl font-bold text-[#7c6ef3]">
            {data.displayName.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{data.displayName}</h1>
            <p className="text-gray-400 text-sm">
              SnapList collector · since {data.memberSince}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <StatCard label="Total Cards" value={data.totalCards.toLocaleString()} />
          <StatCard label="Est. Value" value={`$${data.totalValue.toFixed(0)}`} accent />
          <StatCard label="Games" value={String(data.gameBreakdown.length)} />
        </div>

        {/* Game breakdown */}
        {data.gameBreakdown.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold mb-4 text-sm text-gray-400 uppercase tracking-wider">
              By Game
            </h2>
            <div className="space-y-3">
              {data.gameBreakdown.map((g) => (
                <div key={g.game} className="flex items-center justify-between text-sm">
                  <span className="text-white">{g.game}</span>
                  <div className="flex items-center gap-4 text-gray-400">
                    <span>{g.count} cards</span>
                    <span className="font-semibold text-[#7c6ef3]">${g.value.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top cards */}
        {data.topCards.length > 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
            <h2 className="font-semibold mb-4 text-sm text-gray-400 uppercase tracking-wider">
              Top Cards
            </h2>
            <div className="space-y-3">
              {data.topCards.map((card, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-11 rounded bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
                    {card.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={card.imageUrl}
                        alt={card.name}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <ImageIcon className="w-4 h-4 text-gray-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{card.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {card.setName ?? card.game} · {card.condition}
                      {card.foil && " · Foil"}
                      {card.slabbed && " · Graded"}
                    </p>
                  </div>
                  {card.value > 0 && (
                    <span className="text-sm font-bold text-[#7c6ef3] shrink-0">
                      ${card.value.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="rounded-2xl border border-[#7c6ef3]/30 bg-[#7c6ef3]/10 p-6 text-center">
          <Award className="w-8 h-8 text-[#7c6ef3] mx-auto mb-3" />
          <h3 className="font-bold text-lg mb-1">Track your TCG collection</h3>
          <p className="text-gray-400 text-sm mb-4">
            Scan cards with AI, get live prices, and list directly to eBay.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-[#7c6ef3] text-white font-semibold hover:bg-[#6b5de2] transition-colors"
          >
            Start for free
            <ExternalLink className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-center">
      <div className={`text-2xl font-bold ${accent ? "text-[#7c6ef3]" : "text-white"}`}>
        {value}
      </div>
      <div className="text-xs text-gray-400 mt-0.5 uppercase tracking-wider">{label}</div>
    </div>
  );
}
