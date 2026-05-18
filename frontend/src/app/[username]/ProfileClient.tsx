"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { PostCard } from "@/components/feed/PostCard";
import { FollowButton } from "@/components/social/FollowButton";
import { ProfileSkeleton } from "@/components/social/ProfileSkeleton";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_public: boolean;
  avatar_url: string | null;
  avatar_color: string | null;
}

export function ProfileClient({ profile }: { profile: Profile }) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followStatus, setFollowStatus] = useState<"accepted" | "pending" | null>(null);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [posts, setPosts] = useState<any[]>([]);

  useEffect(() => {
    async function init() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      const isOwner = user?.id === profile.id;
      setIsOwnProfile(isOwner);

      let viewerFollowStatus: "accepted" | "pending" | null = null;
      if (user && !isOwner) {
        try {
          const res = await api.get<{ is_following: boolean; status: string | null }>(
            `/api/follows/check/${profile.id}`
          );
          setIsFollowing(res.is_following);
          viewerFollowStatus = res.status as "accepted" | "pending" | null;
          setFollowStatus(viewerFollowStatus);
        } catch {
          // not logged in
        }
      }

      if (isOwner) {
        try {
          const stats = await api.get<{
            followers: number;
            following: number;
            posts: unknown[];
          }>("/api/profiles/me/stats");
          setFollowerCount(stats.followers);
          setFollowingCount(stats.following);
          setPosts(stats.posts || []);
        } catch (e) {
          console.error("Failed to load stats:", e);
        }
      } else if (profile.is_public || viewerFollowStatus === "accepted") {
        // Public profile, OR private profile that the viewer is an accepted
        // follower of. Either way, load their posts.
        try {
          const res = await api.get<{ posts: unknown[] }>(
            `/api/profiles/${profile.id}/posts`
          );
          setPosts(res.posts || []);
        } catch (e) {
          console.error("Failed to load posts:", e);
        }
      }

      setLoaded(true);
    }
    init();
  }, [profile.id, profile.is_public]);

  if (!loaded) {
    return <ProfileSkeleton />;
  }

  if (!profile.is_public && !isOwnProfile && followStatus !== "accepted") {
    return (
      <div className="space-y-8">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <div className="size-20 shrink-0 rounded-full" style={{ backgroundColor: profile.avatar_color || "#223843" }} />
            <div>
              <h1 className="font-[family-name:var(--font-cabinet)] text-3xl font-bold">
                {profile.display_name || profile.username}
              </h1>
              <p className="text-sm text-text/40">@{profile.username}</p>
              {profile.bio && (
                <p className="mt-2 max-w-md text-sm text-text/60">{profile.bio}</p>
              )}
            </div>
          </div>
          <FollowButton
            userId={profile.id}
            initialFollowing={isFollowing}
            initialStatus={followStatus}
          />
        </div>

        <hr className="border-primary" />

        <div className="relative">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4" aria-hidden>
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-[15px] bg-primary/40"
                style={{ aspectRatio: "2 / 1" }}
              />
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-bg/70">
            <svg width="32" height="32" viewBox="0 0 24 24" className="mb-3 text-text/30">
              <rect x="3" y="11" width="18" height="11" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <p className="font-[family-name:var(--font-cabinet)] text-lg font-bold">
              This account is private
            </p>
            <p className="mt-1 text-sm text-text/40">
              {followStatus === "pending"
                ? "Your follow request is pending"
                : "Follow this account to see their posts"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
        <div className="flex items-center gap-5">
          <div className="size-20 shrink-0 rounded-full" style={{ backgroundColor: profile.avatar_color || "#223843" }} />
          <div>
            <h1 className="font-[family-name:var(--font-cabinet)] text-3xl font-bold">
              {profile.display_name || profile.username}
            </h1>
            <p className="text-sm text-text/40">@{profile.username}</p>
            {profile.bio && (
              <p className="mt-2 max-w-md text-sm text-text/60">{profile.bio}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-6">
          {isOwnProfile && (
            <div className="flex flex-1 justify-around gap-6 text-sm md:flex-none md:justify-start">
              <Link href={`/${profile.username}/followers`} className="text-center hover:text-accent">
                <strong className="block text-lg">{followerCount}</strong>
                <span className="text-text/40">
                  {followerCount === 1 ? "follower" : "followers"}
                </span>
              </Link>
              <Link href={`/${profile.username}/following`} className="text-center hover:text-accent">
                <strong className="block text-lg">{followingCount}</strong>
                <span className="text-text/40">following</span>
              </Link>
              <span className="text-center">
                <strong className="block text-lg">{posts.length}</strong>
                <span className="text-text/40">
                  {posts.length === 1 ? "post" : "posts"}
                </span>
              </span>
            </div>
          )}
          {!isOwnProfile && (
            <FollowButton
              userId={profile.id}
              initialFollowing={isFollowing}
              initialStatus={followStatus}
            />
          )}
        </div>
      </div>

      <hr className="border-primary" />

      {posts.length === 0 ? (
        <p className="py-10 text-center text-sm text-text/40">
          {isOwnProfile ? "You haven't published anything yet." : "No posts yet."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
