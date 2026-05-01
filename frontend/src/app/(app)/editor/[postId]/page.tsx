"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "@/lib/query-keys";
import type { Post, Block } from "@/lib/types/blocks";
import { EditorCanvas } from "@/components/editor/EditorCanvas";
import { EditorSplashScreen } from "@/components/editor/EditorSplashScreen";

export default function EditorPostPage() {
  const { postId } = useParams<{ postId: string }>();

  const { data: post, error: postError } = useQuery({
    queryKey: keys.post(postId),
    queryFn: () => api.get<Post>(`/api/posts/${postId}`),
    enabled: !!postId,
  });

  const { data: blocks, error: blocksError } = useQuery({
    queryKey: keys.postBlocks(postId),
    queryFn: () => api.get<Block[]>(`/api/posts/${postId}/blocks`),
    enabled: !!postId,
  });

  const error = postError || blocksError;

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-red-500">
          {error instanceof Error ? error.message : "Failed to load post"}
        </p>
      </div>
    );
  }

  if (!post || !blocks) {
    return <EditorSplashScreen />;
  }

  return <EditorCanvas post={post} initialBlocks={blocks} />;
}
