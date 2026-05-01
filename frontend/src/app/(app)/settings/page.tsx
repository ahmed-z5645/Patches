"use client";

import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { keys } from "@/lib/query-keys";
import { useRouter } from "next/navigation";
import { SettingsSkeleton } from "@/components/settings/SettingsSkeleton";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_public: boolean;
  avatar_url: string | null;
  avatar_color: string | null;
}

const AVATAR_COLORS = [
  "#223843",
  "#fb5012",
  "#d8b4a0",
  "#dbd3d8",
  "#4a7c59",
  "#6b5b95",
  "#e8a87c",
  "#41b3a3",
  "#c38d9e",
  "#659dbd",
];

export default function SettingsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [avatarColor, setAvatarColor] = useState(AVATAR_COLORS[0]);

  const { data: profile, isLoading: loading } = useQuery({
    queryKey: keys.myProfile(),
    queryFn: () => api.get<Profile>("/api/profiles/me"),
  });

  useEffect(() => {
    if (!profile) return;
    setUsername(profile.username || "");
    setDisplayName(profile.display_name || "");
    setBio(profile.bio || "");
    setIsPublic(profile.is_public);
    setAvatarColor(profile.avatar_color || AVATAR_COLORS[0]);
  }, [profile]);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      await api.put<Profile>("/api/profiles/me", {
        username,
        display_name: displayName || null,
        bio: bio || null,
        is_public: isPublic,
        avatar_color: avatarColor,
      });
      queryClient.invalidateQueries({ queryKey: keys.myProfile() });
      setMessage("Saved!");
      setTimeout(() => setMessage(""), 2000);
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  if (loading) {
    return <SettingsSkeleton />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="font-[family-name:var(--font-cabinet)] text-[64px] font-bold leading-tight">
        Settings
      </h1>

      <div className="max-w-md space-y-5">
        <div>
          <label className="mb-2 block text-sm text-text/60">Profile colour</label>
          <div className="flex items-center gap-4">
            <div
              className="size-16 shrink-0 rounded-full"
              style={{ backgroundColor: avatarColor }}
            />
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  onClick={() => setAvatarColor(color)}
                  className={`size-8 rounded-full transition-transform ${
                    avatarColor === color ? "scale-110 ring-2 ring-text ring-offset-2 ring-offset-bg" : "hover:scale-105"
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-sm text-text/60">Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-[15px] border border-primary bg-transparent px-4 py-3 text-sm outline-none focus:border-text"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-text/60">Display name</label>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-[15px] border border-primary bg-transparent px-4 py-3 text-sm outline-none focus:border-text"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-text/60">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-[15px] border border-primary bg-transparent px-4 py-3 text-sm outline-none focus:border-text"
          />
        </div>

        <div className="flex items-center justify-between">
          <span className="text-sm text-text/60">Public profile</span>
          <button
            onClick={() => setIsPublic(!isPublic)}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              isPublic ? "bg-accent" : "bg-primary"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 size-5 rounded-full bg-bg transition-transform ${
                isPublic ? "translate-x-5" : ""
              }`}
            />
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-[15px] bg-text px-6 py-3 text-sm font-bold text-bg hover:bg-text/90 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {message && (
            <span className="text-sm text-text/60">{message}</span>
          )}
        </div>

        <hr className="border-primary" />

        <button
          onClick={handleSignOut}
          className="rounded-[15px] border border-primary px-6 py-3 text-sm hover:border-accent hover:text-accent"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
