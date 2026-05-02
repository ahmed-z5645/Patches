"use client";

import type { BlockType } from "@/lib/types/blocks";

interface EditorToolbarProps {
  onAddBlock: (type: BlockType) => void;
}

const blockTypes: { type: BlockType; label: string }[] = [
  { type: "markdown", label: "Text" },
  { type: "image", label: "Image" },
  { type: "code", label: "Code" },
  { type: "spotify", label: "Spotify" },
  { type: "apple_music", label: "Apple Music" },
  { type: "strava", label: "Strava" },
];

export function EditorToolbar({ onAddBlock }: EditorToolbarProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {blockTypes.map(({ type, label }) => (
        <button
          key={type}
          onClick={() => onAddBlock(type)}
          className="rounded-[15px] border border-primary px-4 py-2 text-sm transition-colors hover:bg-primary/50"
        >
          + {label}
        </button>
      ))}
    </div>
  );
}
