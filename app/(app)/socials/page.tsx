import { Share2, ExternalLink } from "lucide-react";

interface SocialLink {
  name: string;
  url: string;
  handle: string;
  description: string;
  color: string;
}

const LINKS: SocialLink[] = [
  {
    name: "Twitter / X",
    url: "#",
    handle: "@snaplistapp",
    description: "Updates, new features, and TCG market news",
    color: "bg-sky-500/10 border-sky-500/20 text-sky-400",
  },
  {
    name: "Instagram",
    url: "#",
    handle: "@snaplistapp",
    description: "Card pulls, collection showcases, and behind-the-scenes",
    color: "bg-pink-500/10 border-pink-500/20 text-pink-400",
  },
  {
    name: "YouTube",
    url: "#",
    handle: "SnapList",
    description: "Tutorials, how-to guides, and listing walkthroughs",
    color: "bg-red-500/10 border-red-500/20 text-red-400",
  },
  {
    name: "Discord",
    url: "#",
    handle: "SnapList Community",
    description: "Chat with other sellers, get help, share feedback",
    color: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
  },
  {
    name: "TikTok",
    url: "#",
    handle: "@snaplistapp",
    description: "Quick tips, pack openings, and scanning demos",
    color: "bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-400",
  },
  {
    name: "GitHub",
    url: "#",
    handle: "snaplist",
    description: "Source code, issues, and contributions",
    color: "bg-gray-500/10 border-gray-500/20 text-gray-400",
  },
];

export default function SocialsPage() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Socials</h1>
        <p className="text-sm text-muted mt-1">
          Follow along for updates, tips, and community
        </p>
      </div>

      <div className="space-y-3">
        {LINKS.map((link) => (
          <a
            key={link.name}
            href={link.url}
            target="_blank"
            rel="noreferrer"
            className="card-panel flex items-center gap-4 hover:border-accent/30 transition-colors group block"
          >
            <div className={`w-12 h-12 rounded-xl border flex items-center justify-center shrink-0 ${link.color}`}>
              <Share2 className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{link.name}</span>
                <span className="text-xs text-muted">{link.handle}</span>
              </div>
              <p className="text-sm text-muted mt-0.5">{link.description}</p>
            </div>
            <ExternalLink className="w-4 h-4 text-muted group-hover:text-accent shrink-0 transition-colors" />
          </a>
        ))}
      </div>
    </div>
  );
}
