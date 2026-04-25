const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_public: boolean;
  avatar_url: string | null;
}

async function getProfile(username: string): Promise<Profile | null> {
  try {
    const res = await fetch(`${API_URL}/api/profiles/${username}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);
  return {
    title: profile
      ? `${profile.display_name || profile.username} — Scrapp`
      : "Profile — Scrapp",
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const profile = await getProfile(username);

  if (!profile) {
    return (
      <div className="py-20 text-center">
        <h1 className="text-2xl font-bold">User not found</h1>
        <p className="mt-2 text-gray-500">
          No profile exists for @{username}
        </p>
      </div>
    );
  }

  if (!profile.is_public) {
    return (
      <div className="py-20 text-center">
        <div className="mx-auto mb-4 size-16 rounded-full bg-[#d9d9d9]" />
        <h1 className="text-2xl font-bold">@{profile.username}</h1>
        <p className="mt-2 text-gray-500">This profile is private</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center gap-4">
        <div className="size-16 rounded-full bg-[#d9d9d9]" />
        <div>
          <h1 className="text-2xl font-bold">
            {profile.display_name || profile.username}
          </h1>
          <p className="text-sm text-gray-500">@{profile.username}</p>
          {profile.bio && <p className="mt-1 text-sm">{profile.bio}</p>}
        </div>
      </div>
      <p className="text-gray-500">No posts yet.</p>
    </div>
  );
}
