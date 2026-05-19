"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import type { Post } from "@/lib/types/blocks";

export interface WeekOption {
  role: "missed" | "current" | "next";
  week_number: number;
  year: number;
  is_late: boolean;
  unlocks_feed: boolean;
  has_post: boolean;
  is_published: boolean;
  post_id: string | null;
}

const ROLE_CHIP: Record<WeekOption["role"], string> = {
  missed: "Missed",
  current: "This week",
  next: "Next week",
};

const ROLE_NOTE: Record<WeekOption["role"], string> = {
  missed: "Catch-up...",
  current: "Unlocks this week's feed",
  next: "Don't be late for next week!",
};

export function WeekPicker({ options }: { options: WeekOption[] }) {
  const router = useRouter();
  const [pendingWeek, setPendingWeek] = useState<number | null>(null);

  async function choose(opt: WeekOption) {
    if (opt.is_published || pendingWeek !== null) return;
    setPendingWeek(opt.week_number);
    try {
      const post = await api.post<Post>("/api/posts", {
        week_number: opt.week_number,
        year: opt.year,
      });
      router.replace(`/editor/${post.id}`);
    } catch (err) {
      console.error("Failed to open post for week", opt, err);
      setPendingWeek(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="space-y-2">
        <h1 className="font-[family-name:var(--font-cabinet)] text-[48px] font-bold leading-tight md:text-[64px]">
          Choose a week
        </h1>
        <p className="text-sm text-text/60">
          Pick which edition week this post is for.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {options.map((opt) => {
          const disabled = opt.is_published;
          const isPending = pendingWeek === opt.week_number;
          return (
            <motion.button
              key={`${opt.year}-${opt.week_number}`}
              type="button"
              onClick={() => choose(opt)}
              disabled={disabled || pendingWeek !== null}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex flex-col items-start gap-3 rounded-[15px] border border-primary p-6 text-left transition-colors ${
                disabled
                  ? "cursor-not-allowed opacity-50"
                  : "hover:border-accent hover:bg-primary/40"
              }`}
            >
              <span className="rounded-full bg-primary px-3 py-1 text-xs font-bold uppercase tracking-wide text-text/70">
                {ROLE_CHIP[opt.role]}
              </span>
              <span className="font-[family-name:var(--font-cabinet)] text-2xl font-bold">
                Week {opt.week_number}, {opt.year}
              </span>
              <span className="text-sm text-text/60">{ROLE_NOTE[opt.role]}</span>
              <span className="mt-1 text-xs font-medium text-text/40">
                {isPending
                  ? "Opening…"
                  : opt.is_published
                    ? "Published ✓"
                    : opt.has_post
                      ? "Draft in progress"
                      : "Empty"}
              </span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
