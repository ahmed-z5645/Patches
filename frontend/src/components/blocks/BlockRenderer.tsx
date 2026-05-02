"use client";

import type { Block } from "@/lib/types/blocks";
import { MarkdownBlock } from "./MarkdownBlock";
import { ImageBlock } from "./ImageBlock";
import { QuoteBlock } from "./QuoteBlock";
import { CodeBlock } from "./CodeBlock";
import { EmbedBlock } from "./EmbedBlock";

interface BlockRendererProps {
  block: Block;
  childBlocks?: Block[];
  isEditing?: boolean;
  onUpdate?: (blockId: string, content: Record<string, unknown>) => void;
}

export function BlockRenderer({
  block,
  childBlocks,
  isEditing,
  onUpdate,
}: BlockRendererProps) {
  const handleUpdate = (content: Record<string, unknown>) => {
    onUpdate?.(block.id, content);
  };

  switch (block.type) {
    case "markdown":
      return (
        <MarkdownBlock
          block={block}
          childBlocks={childBlocks}
          isEditing={isEditing}
          onUpdate={handleUpdate}
        />
      );
    case "image":
      return (
        <ImageBlock
          block={block}
          isEditing={isEditing}
          onUpdate={handleUpdate}
        />
      );
    case "quote":
      return (
        <QuoteBlock
          block={block}
          isEditing={isEditing}
          onUpdate={handleUpdate}
        />
      );
    case "code":
      return (
        <CodeBlock
          block={block}
          isEditing={isEditing}
          onUpdate={handleUpdate}
        />
      );
    case "spotify":
      return (
        <EmbedBlock
          url={block.content.url}
          label="Spotify"
          isEditing={isEditing}
          onUpdate={handleUpdate}
        />
      );
    case "apple_music":
      return (
        <EmbedBlock
          url={block.content.url}
          label="Apple Music"
          isEditing={isEditing}
          onUpdate={handleUpdate}
        />
      );
    case "strava":
      return (
        <EmbedBlock
          url={block.content.url}
          label="Strava"
          isEditing={isEditing}
          onUpdate={handleUpdate}
        />
      );
    case "map":
      return (
        <div className="flex h-full items-center justify-center p-4 text-sm text-text/30">
          Map: {block.content.label || `${block.content.lat}, ${block.content.lng}`}
        </div>
      );
    case "weather":
      return (
        <div className="flex h-full items-center justify-center p-4 text-sm text-text/30">
          Weather: {block.content.city}
        </div>
      );
    default:
      return null;
  }
}
