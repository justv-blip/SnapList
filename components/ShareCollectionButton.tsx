"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";

interface Props {
  userId: string;
}

export default function ShareCollectionButton({ userId }: Props) {
  const [copied, setCopied] = useState(false);

  const shareUrl = `https://snaplist.gg/share/${userId}`;

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // fallback: open share URL in new tab
      window.open(shareUrl, "_blank");
    }
  };

  return (
    <button
      onClick={handleShare}
      className="btn flex items-center gap-2"
      title="Share your collection"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4 text-accent2" /> Link copied!
        </>
      ) : (
        <>
          <Share2 className="w-4 h-4" /> Share
        </>
      )}
    </button>
  );
}
