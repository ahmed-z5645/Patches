"use client";

import { useState } from "react";
import type { QuoteBlock as QuoteBlockType } from "@/lib/types/blocks";

interface QuoteBlockProps {
  block: QuoteBlockType;
  isEditing?: boolean;
  onUpdate?: (content: { text: string; attribution?: string }) => void;
}

export function QuoteBlock({ block, isEditing, onUpdate }: QuoteBlockProps) {
  const [text, setText] = useState(block.content.text);
  const [attribution, setAttribution] = useState(
    block.content.attribution || ""
  );

  function handleTextChange(value: string) {
    setText(value);
    onUpdate?.({ text: value, attribution: attribution || undefined });
  }

  function handleAttributionChange(value: string) {
    setAttribution(value);
    onUpdate?.({ text, attribution: value || undefined });
  }

  return (
    <div className="flex h-full flex-col justify-center border-l-4 border-accent p-5">
      {isEditing ? (
        <>
          <textarea
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            placeholder="Write a quote..."
            className="flex-1 resize-none bg-transparent text-lg font-medium italic leading-relaxed outline-none placeholder:text-text/20"
          />
          <input
            type="text"
            value={attribution}
            onChange={(e) => handleAttributionChange(e.target.value)}
            placeholder="— Attribution"
            className="mt-2 bg-transparent text-sm text-text/50 outline-none placeholder:text-text/20"
          />
        </>
      ) : (
        <>
          <p className="text-lg font-medium italic leading-relaxed">
            {block.content.text || "Empty quote"}
          </p>
          {block.content.attribution && (
            <p className="mt-2 text-sm text-text/50">
              — {block.content.attribution}
            </p>
          )}
        </>
      )}
    </div>
  );
}
