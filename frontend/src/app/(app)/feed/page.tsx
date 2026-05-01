"use client";

import { useRef, useCallback, useEffect } from "react";
import { useQuery, useInfiniteQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "@/lib/query-keys";
import { FeedLockGate } from "@/components/feed/FeedLockGate";
import { FeedSkeleton } from "@/components/feed/FeedSkeleton";
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
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data: feed, isLoading } = useQuery({
    queryKey: keys.feed(),
    queryFn: () => api.get<FeedResponse>("/api/feed"),
    staleTime: 2 * 60 * 1000,
  });

  const {
    data: olderData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: keys.feedOlder(),
    queryFn: ({ pageParam }) =>
      api.get<OlderResponse>(`/api/feed/older?offset=${pageParam}&limit=6`),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      if (!lastPage.has_more) return undefined;
      return allPages.reduce((sum, p) => sum + p.posts.length, 0);
    },
    enabled: !!feed && !feed.locked,
    staleTime: 2 * 60 * 1000,
  });

  const olderPosts = olderData?.pages.flatMap((p) => p.posts) ?? [];

  const loadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  useEffect(() => {
    if (!feed || feed.locked) return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) loadMore(); },
      { rootMargin: "200px" }
    );
    const el = sentinelRef.current;
    if (el) observer.observe(el);
    return () => { if (el) observer.unobserve(el); };
  }, [feed, loadMore]);

  if (isLoading) return <FeedSkeleton />;

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

          {isFetchingNextPage && (
            <div className="flex justify-center py-6">
              <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          )}
        </>
      )}
    </div>
  );
}
