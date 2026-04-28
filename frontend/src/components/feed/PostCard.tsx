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
  const titleSize = compact ? "text-3xl" : "text-3xl md:text-6xl";

  const inner = (
    <div
      className={`flex aspect-[2/1] flex-col justify-between p-5 ${!editable ? "group" : ""}`}
    >
      <div>
        {post.profiles?.username && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-white/60">
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
      <p className="line-clamp-2 text-sm leading-relaxed text-white/70">
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
