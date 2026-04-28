"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { createClient } from "@/lib/supabase/client";
import { PostCard } from "@/components/feed/PostCard";
import { FollowButton } from "@/components/social/FollowButton";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_public: boolean;
  avatar_url: string | null;
}

export function ProfileClient({ profile }: { profile: Profile }) {
  const [isFollowing, setIsFollowing] = useState(false);
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

      if (user && !isOwner) {
        try {
          const res = await api.get<{ is_following: boolean }>(
            `/api/follows/check/${profile.id}`
          );
          setIsFollowing(res.is_following);
        } catch {
          // not logged in
        }
      }

      if (isOwner) {
        try {
          const [followers, following, myPosts] = await Promise.all([
            api.get<unknown[]>("/api/follows/followers"),
            api.get<unknown[]>("/api/follows/following"),
            api.get<{ posts: unknown[] }>("/api/feed/my-posts"),
          ]);
          setFollowerCount(followers.length);
          setFollowingCount(following.length);
          setPosts(myPosts.posts || []);
        } catch {
          // failed
        }
      } else if (profile.is_public) {
        try {
          const res = await api.get<{ posts: unknown[] }>(
            `/api/profiles/${profile.id}/posts`
          );
          setPosts(res.posts || []);
        } catch {
          // failed
        }
      }

      setLoaded(true);
    }
    init();
  }, [profile.id, profile.is_public]);

  if (!loaded) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!profile.is_public && !isOwnProfile) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 size-16 rounded-full bg-primary" />
        <h1 className="font-[family-name:var(--font-cabinet)] text-2xl font-bold">
          @{profile.username}
        </h1>
        <p className="mt-2 text-sm text-text/40">This profile is private</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-5">
          <div className="size-20 rounded-full bg-primary" />
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
        {!isOwnProfile && (
          <FollowButton userId={profile.id} initialFollowing={isFollowing} />
        )}
      </div>

      {isOwnProfile && (
        <div className="flex gap-6 text-sm">
          <span>
            <strong>{followerCount}</strong>{" "}
            <span className="text-text/40">
              {followerCount === 1 ? "follower" : "followers"}
            </span>
          </span>
          <span>
            <strong>{followingCount}</strong>{" "}
            <span className="text-text/40">following</span>
          </span>
          <span>
            <strong>{posts.length}</strong>{" "}
            <span className="text-text/40">
              {posts.length === 1 ? "post" : "posts"}
            </span>
          </span>
        </div>
      )}

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
