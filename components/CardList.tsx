"use client";

import type { ScannedCard } from "@/lib/types";
import CardRow from "./CardRow";
import { Inbox } from "lucide-react";

interface Props {
  cards: ScannedCard[];
  onChange: (id: string, patch: Partial<ScannedCard>) => void;
  onRemove: (id: string) => void;
  onRelookup: (id: string) => void;
  onVerify?: (id: string) => void;
  ebayConnected?: boolean;
}

export default function CardList({ cards, onChange, onRemove, onRelookup, onVerify, ebayConnected }: Props) {
  if (cards.length === 0) {
    return (
      <div className="card-panel flex flex-col items-center justify-center text-center py-16">
        <div className="w-12 h-12 rounded-full bg-panel2 border border-border flex items-center justify-center mb-3">
          <Inbox className="w-5 h-5 text-muted" />
        </div>
        <h3 className="font-medium">No cards scanned yet</h3>
        <p className="text-sm text-muted mt-1 max-w-md">
          Upload photos of your cards above to begin. Identified cards will
          appear here with editable details and a market price estimate when
          available.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {cards.map((c) => (
        <CardRow
          key={c.id}
          card={c}
          onChange={(patch) => onChange(c.id, patch)}
          onRemove={() => onRemove(c.id)}
          onRelookup={() => onRelookup(c.id)}
          onVerify={onVerify ? () => onVerify(c.id) : undefined}
          ebayConnected={ebayConnected}
        />
      ))}
    </div>
  );
}
