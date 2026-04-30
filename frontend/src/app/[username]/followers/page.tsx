"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { FollowButton } from "@/components/social/FollowButton";
import { createClient } from "@/lib/supabase/client";

interface UserRow {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  is_following_back: boolean;
}

export default function FollowersPage() {
  const { username } = useParams<{ username: string }>();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      setCurrentUserId(user?.id || null);

      try {
        const data = await api.get<UserRow[]>("/api/follows/followers");
        setUsers(data);
      } catch {
        // failed
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [username]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href={`/${username}`}
          className="text-sm text-text/40 hover:text-text/60"
        >
          &larr; @{username}
        </Link>
      </div>

      <h1 className="font-[family-name:var(--font-cabinet)] text-3xl font-bold">
        Followers
      </h1>

      {loading ? (
        <div className="flex h-32 items-center justify-center">
          <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : users.length === 0 ? (
        <p className="py-10 text-center text-sm text-text/40">
          No followers yet.
        </p>
      ) : (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="flex items-center justify-between rounded-[15px] border border-primary p-4"
            >
              <Link
                href={`/${user.username}`}
                className="flex items-center gap-3"
              >
                <div className="size-10 rounded-full bg-primary" />
                <div>
                  <p className="text-sm font-medium">
                    {user.display_name || user.username}
                  </p>
                  <p className="text-xs text-text/40">@{user.username}</p>
                </div>
              </Link>
              {user.id !== currentUserId && (
                <FollowButton
                  userId={user.id}
                  initialFollowing={user.is_following_back}
                  initialStatus={user.is_following_back ? "accepted" : null}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
