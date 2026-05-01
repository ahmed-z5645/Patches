"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "@/lib/query-keys";
import type { Post } from "@/lib/types/blocks";
import { EditorSplashScreen } from "@/components/editor/EditorSplashScreen";

export default function EditorPage() {
  const router = useRouter();

  const { data: post, error } = useQuery({
    queryKey: keys.currentPost(),
    queryFn: () => api.get<Post>("/api/posts/me/current-week"),
  });

  useEffect(() => {
    if (post) router.replace(`/editor/${post.id}`);
  }, [post, router]);

  if (error) console.error("Failed to get current week post:", error);

  return <EditorSplashScreen />;
}
