"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { PostCard, type PostCardData } from "@/components/feed/PostCard";
import { FollowButton } from "@/components/social/FollowButton";

type Mode = "users" | "posts";

interface UserResult {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  is_following: boolean;
}

interface PostResult {
  id: string;
  user_id: string;
  title: string | null;
  week_number: number;
  year: number;
  word_count: number;
  cover_color: string | null;
  tags: string[];
  is_late: boolean;
  published_at: string | null;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function SearchPage() {
  const [mode, setMode] = useState<Mode>("users");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<UserResult[]>([]);
  const [posts, setPosts] = useState<PostResult[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) {
      setUsers([]);
      setPosts([]);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        if (mode === "users") {
          const res = await api.get<UserResult[]>(
            `/api/search/users?q=${encodeURIComponent(query)}`
          );
          setUsers(res);
        } else {
          const res = await api.get<PostResult[]>(
            `/api/search/posts?q=${encodeURIComponent(query)}`
          );
          setPosts(res);
        }
      } catch (e) {
        console.error("Search failed:", e);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, mode]);

  function handleModeSwitch(newMode: Mode) {
    setMode(newMode);
    setUsers([]);
    setPosts([]);
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="font-[family-name:var(--font-cabinet)] text-[64px] font-bold leading-tight">
        Search
      </h1>

      <div className="flex gap-2">
        <button
          onClick={() => handleModeSwitch("users")}
          className={`flex-1 rounded-[15px] px-5 py-2 text-sm font-medium transition-colors md:flex-none ${
            mode === "users"
              ? "bg-text text-bg"
              : "border border-primary text-text/60 hover:border-text"
          }`}
        >
          People
        </button>
        <button
          onClick={() => handleModeSwitch("posts")}
          className={`flex-1 rounded-[15px] px-5 py-2 text-sm font-medium transition-colors md:flex-none ${
            mode === "posts"
              ? "bg-text text-bg"
              : "border border-primary text-text/60 hover:border-text"
          }`}
        >
          Posts
        </button>
      </div>

      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={
          mode === "users"
            ? "Search for people..."
            : "Search posts from your feed..."
        }
        className="w-full rounded-[15px] border border-primary bg-transparent px-5 py-3 text-sm outline-none focus:border-accent"
      />

      {loading && (
        <div className="flex justify-center py-10">
          <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      )}

      {!loading && mode === "users" && query.trim() && (
        <div className="space-y-3">
          {users.length === 0 ? (
            <p className="py-10 text-center text-sm text-text/40">
              No users found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-[15px] border border-primary p-4"
              >
                <Link
                  href={`/${user.username}`}
                  className="flex items-center gap-4"
                >
                  <div className="size-10 rounded-full bg-primary" />
                  <div>
                    <p className="text-sm font-bold">
                      {user.display_name || user.username}
                    </p>
                    <p className="text-xs text-text/40">@{user.username}</p>
                    {user.bio && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-text/50">
                        {user.bio}
                      </p>
                    )}
                  </div>
                </Link>
                <FollowButton
                  userId={user.id}
                  initialFollowing={user.is_following}
                />
              </div>
            ))
          )}
        </div>
      )}

      {!loading && mode === "posts" && query.trim() && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {posts.length === 0 ? (
            <p className="col-span-full py-10 text-center text-sm text-text/40">
              No posts found for &ldquo;{query}&rdquo;
            </p>
          ) : (
            posts.map((post) => (
              <PostCard
                key={post.id}
                post={{
                  ...post,
                  blocks: [],
                  profiles: {
                    username: post.username,
                    display_name: post.display_name,
                    avatar_url: post.avatar_url,
                  },
                }}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}
