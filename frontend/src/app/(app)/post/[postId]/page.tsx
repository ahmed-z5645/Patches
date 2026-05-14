"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "@/lib/query-keys";
import type { Block, Post } from "@/lib/types/blocks";
import { BentoGrid } from "@/components/bento/BentoGrid";
import { BentoTile } from "@/components/bento/BentoTile";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { LateBadge } from "@/components/feed/LateBadge";
import { EditorSplashScreen } from "@/components/editor/EditorSplashScreen";

interface FullPost extends Post {
  blocks: Block[];
  profiles?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

export default function PostPage() {
  const { postId } = useParams<{ postId: string }>();

  const { data: post, isLoading, error } = useQuery({
    queryKey: keys.post(postId),
    queryFn: () => api.get<FullPost>(`/api/posts/${postId}`),
    enabled: !!postId,
  });

  const topLevelBlocks = useMemo(
    () => (post?.blocks || []).filter((b) => !b.parent_block_id),
    [post?.blocks]
  );

  const childBlocksMap = useMemo(() => {
    const map: Record<string, Block[]> = {};
    for (const b of post?.blocks || []) {
      if (b.parent_block_id) {
        if (!map[b.parent_block_id]) map[b.parent_block_id] = [];
        map[b.parent_block_id].push(b);
      }
    }
    return map;
  }, [post?.blocks]);

  if (isLoading) {
    return <EditorSplashScreen />;
  }

  if (error || !post) {
    return (
      <div className="mx-auto max-w-5xl space-y-4 py-20 text-center">
        <h1 className="font-[family-name:var(--font-cabinet)] text-2xl font-bold">
          Post not found
        </h1>
        <Link href="/feed" className="text-sm text-accent underline">
          Back to feed
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/feed"
        className="inline-block text-sm text-text/40 hover:text-text/60"
      >
        &larr; Back to feed
      </Link>

      <h1 className="w-full font-[family-name:var(--font-cabinet)] text-[48px] font-bold leading-tight md:text-[64px]">
        {post.title}
      </h1>

      <div className="flex items-center gap-3">
        {post.profiles?.username && (
          <Link
            href={`/${post.profiles.username}`}
            className="text-sm text-text/40 hover:text-accent"
          >
            @{post.profiles.username}
          </Link>
        )}
        {post.is_late && <LateBadge />}
        <span className="text-sm text-text/40">
          Week {post.week_number}, {post.year}
        </span>
      </div>

      <BentoGrid>
        {topLevelBlocks.map((block) => (
          <BentoTile
            key={block.id}
            desktopLayout={block.grid_layout_desktop}
            mobileLayout={block.grid_layout_mobile}
            withBorder
            blockStyle={block.style}
            autoHeight={block.type === "markdown"}
          >
            <BlockRenderer
              block={block}
              childBlocks={childBlocksMap[block.id]}
            />
          </BentoTile>
        ))}
      </BentoGrid>
    </div>
  );
}
