"use client";

import type { Block, Post } from "@/lib/types/blocks";
import { BentoTile } from "@/components/bento/BentoTile";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";

interface FeedPost extends Post {
  blocks: Block[];
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export function FeedCard({ post }: { post: FeedPost }) {
  const topLevel = (post.blocks || []).filter((b) => !b.parent_block_id);
  const maxRow = topLevel.reduce((max, b) => {
    const end = b.grid_layout_desktop.rowStart + b.grid_layout_desktop.rowSpan;
    return end > max ? end : max;
  }, 1);

  return (
    <div className="space-y-3">
      <div
        className="flex flex-col justify-end rounded-[15px] p-5"
        style={{
          backgroundColor: post.cover_color || "#d9d9d9",
          height: 160,
        }}
      >
        <h3
          className="text-lg font-bold leading-tight font-[family-name:var(--font-cabinet)]"
          style={{
            color: post.cover_color === "#223843" ? "#eff1f3" : "#223843",
          }}
        >
          {post.title}
        </h3>
        <p
          className="mt-1 text-xs"
          style={{
            color: post.cover_color === "#223843" ? "#eff1f3" : "#223843",
            opacity: 0.6,
          }}
        >
          {post.profiles?.username && `@${post.profiles.username}`}
          {post.is_late && " · Late"}
        </p>
      </div>

      {post.tags && post.tags.length > 0 && (
        <div className="flex gap-2">
          {post.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-text/10 px-3 py-1 text-xs"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gridAutoRows: "calc((100% - 48px) / 4 / 2)",
          gap: 16,
          minHeight: maxRow * 40,
        }}
      >
        {topLevel.map((block) => (
          <BentoTile
            key={block.id}
            desktopLayout={block.grid_layout_desktop}
            mobileLayout={block.grid_layout_mobile}
            blockStyle={block.style}
          >
            <BlockRenderer block={block} />
          </BentoTile>
        ))}
      </div>
    </div>
  );
}
