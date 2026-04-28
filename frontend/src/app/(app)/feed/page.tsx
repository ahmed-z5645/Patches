"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "@/lib/api";
import { FeedLockGate } from "@/components/feed/FeedLockGate";
import { PostCard, type PostCardData } from "@/components/feed/PostCard";

interface FeedResponse {
  locked: boolean;
  posts?: PostCardData[];
  post_count?: number;
  week: number;
  year: number;
}

interface OlderResponse {
  posts: PostCardData[];
  has_more: boolean;
}

export default function FeedPage() {
  const [feed, setFeed] = useState<FeedResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const [olderPosts, setOlderPosts] = useState<PostCardData[]>([]);
  const [olderOffset, setOlderOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .get<FeedResponse>("/api/feed")
      .then(setFeed)
      .catch((e) => console.error("Failed to load feed:", e))
      .finally(() => setLoading(false));
  }, []);

  const loadMore = useCallback(async () => {
    if (loadingOlder || !hasMore) return;
    setLoadingOlder(true);
    try {
      const res = await api.get<OlderResponse>(
        `/api/feed/older?offset=${olderOffset}&limit=6`
      );
      setOlderPosts((prev) => [...prev, ...res.posts]);
      setOlderOffset((prev) => prev + res.posts.length);
      setHasMore(res.has_more);
    } catch (e) {
      console.error("Failed to load older posts:", e);
    } finally {
      setLoadingOlder(false);
    }
  }, [olderOffset, hasMore, loadingOlder]);

  useEffect(() => {
    if (!feed || feed.locked) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "200px" }
    );

    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => {
      if (el) observer.unobserve(el);
    };
  }, [feed, loadMore]);

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!feed) {
    return (
      <div className="mx-auto max-w-7xl space-y-6">
        <h1 className="font-[family-name:var(--font-cabinet)] text-[64px] font-bold leading-tight">
          Feed
        </h1>
        <p className="text-sm text-text/40">Something went wrong loading the feed.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="font-[family-name:var(--font-cabinet)] text-[64px] font-bold leading-tight">
          Feed
        </h1>
        <span className="text-sm text-text/40">
          Week {feed.week}, {feed.year}
        </span>
      </div>

      {feed.locked ? (
        <FeedLockGate postCount={feed.post_count || 0} />
      ) : feed.posts && feed.posts.length > 0 ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {feed.posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center rounded-[15px] border border-primary py-20">
          <p className="text-sm text-text/40">
            No posts yet this week from people you follow.
          </p>
        </div>
      )}

      {!feed.locked && (
        <>
          {olderPosts.length > 0 && (
            <div className="space-y-6 pt-6">
              <h2 className="font-[family-name:var(--font-cabinet)] text-3xl font-bold text-text/60">
                You might have missed
              </h2>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                {olderPosts.map((post) => (
                  <PostCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          )}

          <div ref={sentinelRef} className="h-1" />

          {loadingOlder && (
            <div className="flex justify-center py-6">
              <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
