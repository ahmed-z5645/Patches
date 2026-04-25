"use client";

import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function SettingsPage() {
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-[64px] font-normal leading-tight">Settings</h1>
      <div className="max-w-md space-y-4">
        <p className="text-sm text-gray-500">
          Profile settings will be available here.
        </p>
        <button
          onClick={handleSignOut}
          className="rounded-[15px] border border-[#d9d9d9] px-6 py-3 text-sm hover:bg-gray-50"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}
