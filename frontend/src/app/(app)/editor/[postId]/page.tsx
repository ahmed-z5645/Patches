"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "@/lib/query-keys";
import type { Post, Block } from "@/lib/types/blocks";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorSplashScreen } from "@/components/editor/EditorSplashScreen";

type PostWithBlocks = Post & { blocks: Block[] };

export default function EditorPostPage() {
  const { postId } = useParams<{ postId: string }>();

  const { data: post, error } = useQuery({
    queryKey: keys.post(postId),
    queryFn: () => api.get<PostWithBlocks>(`/api/posts/${postId}`),
    enabled: !!postId,
  });

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">
          {error instanceof Error ? error.message : "Failed to load post"}
        </p>
      </div>
    );
  }

  if (!post) {
    return <EditorSplashScreen />;
  }

  return <EditorCanvas post={post} initialBlocks={post.blocks ?? []} />;
}
