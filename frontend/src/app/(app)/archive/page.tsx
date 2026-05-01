"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { keys } from "@/lib/query-keys";
import { FeedCard } from "@/components/feed/FeedCard";

interface ArchiveWeek {
  week_number: number;
  year: number;
  posts: Array<Record<string, unknown>>;
}

interface ArchiveResponse {
  weeks: ArchiveWeek[];
}

export default function ArchivePage() {
  const { data: archive, isLoading } = useQuery({
    queryKey: keys.archive(),
    queryFn: () => api.get<ArchiveResponse>("/api/feed/archive"),
    staleTime: 10 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <h1 className="font-[family-name:var(--font-cabinet)] text-[64px] font-bold leading-tight">
        Archive
      </h1>

      {!archive || archive.weeks.length === 0 ? (
        <p className="text-sm text-text/40">
          No past posts yet from people you follow.
        </p>
      ) : (
        <div className="space-y-12">
          {archive.weeks.map((week) => (
            <div key={`${week.year}-${week.week_number}`} className="space-y-6">
              <h2 className="font-[family-name:var(--font-cabinet)] text-xl font-bold text-text/60">
                Week {week.week_number}, {week.year}
              </h2>
              <div className="space-y-10">
                {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                {week.posts.map((post: any) => (
                  <FeedCard key={post.id} post={post} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
