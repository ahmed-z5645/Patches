"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  is_public: boolean;
  avatar_url: string | null;
}

export default function SettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  useEffect(() => {
    api
      .get<Profile>("/api/profiles/me")
      .then((p) => {
        setProfile(p);
        setUsername(p.username || "");
        setDisplayName(p.display_name || "");
        setBio(p.bio || "");
        setIsPublic(p.is_public);
      })
      .catch((e) => console.error("Failed to load profile:", e))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage("");
    try {
      const updated = await api.put<Profile>("/api/profiles/me", {
        username,
        display_name: displayName || null,
        bio: bio || null,
        is_public: isPublic,
      });
      setProfile(updated);
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
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h1 className="font-[family-name:var(--font-cabinet)] text-[64px] font-bold leading-tight">
        Settings
      </h1>

      <div className="max-w-md space-y-5">
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
