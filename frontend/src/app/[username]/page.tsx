import { cache } from "react";
import { ProfileClient } from "./ProfileClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_public: boolean;
  avatar_url: string | null;
  avatar_color: string | null;
}

// cache() dedupes the fetch across generateMetadata and the page component
// within a single request — drops profile loads from 2 → 1 per page view.
const getProfile = cache(async (username: string): Promise<Profile | null> => {
  try {
    const res = await fetch(`${API_URL}/api/profiles/${username}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);
  return {
    title: profile
      ? `${profile.display_name || profile.username} — Patches`
      : "Profile — Patches",
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    return (
      <div className="py-20 text-center">
        <h1 className="font-[family-name:var(--font-cabinet)] text-2xl font-bold">
          User not found
        </h1>
        <p className="mt-2 text-sm text-text/40">
          No profile exists for @{username}
        </p>
      </div>
    );
  }

  return <ProfileClient profile={profile} />;
}
