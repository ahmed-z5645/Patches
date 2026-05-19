"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "@/lib/query-keys";
import type { Post } from "@/lib/types/blocks";
import { EditorSplashScreen } from "@/components/editor/EditorSplashScreen";
import { WeekPicker, type WeekOption } from "@/components/editor/WeekPicker";

export default function EditorPage() {
  const router = useRouter();

  const { data: options, error: optionsError } = useQuery({
    queryKey: keys.weekOptions(),
    queryFn: () => api.get<WeekOption[]>("/api/posts/me/week-options"),
  });

  // A real choice exists when the user has an open missed week to catch up on,
  // or already published this week (so the only path forward is next week).
  // Otherwise the current week is the sole sensible target — skip the picker.
  const missedOpen = options?.some((o) => o.role === "missed") ?? false;
  const currentPublished =
    options?.find((o) => o.role === "current")?.is_published ?? false;
  const hasRealChoice = !!options && (missedOpen || currentPublished);
  const skipPicker = !!options && !hasRealChoice;

  const { data: post, error: postError } = useQuery({
    queryKey: keys.editorPost(),
    queryFn: () => api.get<Post>("/api/posts/me/editor"),
    enabled: skipPicker,
  });

  useEffect(() => {
    if (post) router.replace(`/editor/${post.id}`);
  }, [post, router]);

  if (optionsError) console.error("Failed to load week options:", optionsError);
  if (postError) console.error("Failed to get editor post:", postError);

  if (hasRealChoice && options) return <WeekPicker options={options} />;

  return <EditorSplashScreen />;
}
