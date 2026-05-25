"use client";

import Link from "next/link";
import { LateBadge } from "./LateBadge";

interface PostCardBlock {
  id: string;
  type: string;
  content: Record<string, unknown>;
  parent_block_id: string | null;
}

export interface PostCardData {
  id: string;
  title: string | null;
  cover_color: string | null;
  is_late: boolean;
  word_count: number;
  blocks?: PostCardBlock[];
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

function getPreview(post: PostCardData): string {
  const markdown = (post.blocks || []).find(
    (b) => b.type === "markdown" && !b.parent_block_id
  );
  if (!markdown) return "";
  const raw = (markdown.content as { markdown?: string }).markdown || "";
  const plain = raw
    .replace(/[#*_~`>\[\]()!]/g, "")
    .replace(/\n+/g, " ")
    .trim();
  return plain.length > 140 ? plain.slice(0, 140) + "..." : plain;
}

interface PostCardProps {
  post: PostCardData;
  editable?: boolean;
  compact?: boolean;
  onTitleChange?: (value: string) => void;
}

export function PostCard({ post, editable, compact, onTitleChange }: PostCardProps) {
  const preview = getPreview(post);
  // Compact mode scales every text size + padding so the card reads as a
  // small-but-proportional version of the full feed card, not a shrunken
  // card with oversized text.
  // Compact sizes are tuned to match the proportions of the full feed card
  // (text-6xl title on a ~464px-wide cover ⇒ ratio ~0.13). At ~360px compact
  // width that lands on text-5xl title, with body/username/padding scaled
  // by the same factor.
  const titleSize = compact ? "text-5xl" : "text-3xl md:text-6xl";
  const usernameSize = compact ? "text-[10px]" : "text-xs";
  const previewSize = compact ? "text-[11px]" : "text-sm";
  const padding = compact ? "p-4" : "p-5";

  const inner = (
    <div
      className={`flex aspect-[2/1] flex-col justify-between ${padding} ${!editable ? "group" : ""}`}
    >
      <div>
        {post.profiles?.username && (
          <div className="flex items-center gap-2">
            <span className={`${usernameSize} font-medium text-white/60`}>
              @{post.profiles.username}
            </span>
            {post.is_late && <LateBadge />}
          </div>
        )}
        {editable ? (
          <input
            type="text"
            value={post.title || ""}
            onChange={(e) => onTitleChange?.(e.target.value)}
            placeholder="Title your week..."
            className={`mt-1 w-full bg-transparent font-[family-name:var(--font-cabinet)] ${titleSize} font-bold leading-tight text-white outline-none placeholder:text-white/30`}
          />
        ) : (
          <h3 className={`mt-1 line-clamp-2 font-[family-name:var(--font-cabinet)] ${titleSize} font-bold leading-tight text-white transition-opacity group-hover:opacity-80`}>
            {post.title}
          </h3>
        )}
      </div>
      <p className={`line-clamp-2 ${previewSize} leading-relaxed text-white/70`}>
        {preview}
      </p>
    </div>
  );

  if (editable) {
    return (
      <div
        className="overflow-hidden rounded-[15px]"
        style={{ backgroundColor: post.cover_color || "#d9d9d9" }}
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={`/post/${post.id}`}
      className="group col-span-2 block overflow-hidden rounded-[15px] transition-shadow hover:shadow-lg"
      style={{ backgroundColor: post.cover_color || "#d9d9d9" }}
    >
      {inner}
    </Link>
  );
}
