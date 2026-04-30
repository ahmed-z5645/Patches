import { Sidebar } from "@/components/layout/Sidebar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { CountdownPill } from "@/components/layout/CountdownPill";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default async function PublicProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let avatarColor = "#223843";
  try {
    const res = await fetch(`${API_URL}/api/profiles/${username}`, { cache: "no-store" });
    if (res.ok) {
      const profile = await res.json();
      avatarColor = profile.avatar_color || "#223843";
    }
  } catch {
    // fallback to default
  }

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <div className="md:ml-[80px]">
        <header className="flex h-[80px] items-center justify-between border-b border-primary px-6 md:px-10">
          <div className="flex items-center gap-3">
            <div className="size-[35px] rounded-full" style={{ backgroundColor: avatarColor }} />
            <span className="text-[25px]">@{username}</span>
          </div>
          <CountdownPill />
        </header>
        <main className="mx-auto max-w-7xl px-6 py-6 pb-[100px] md:px-10 md:pb-6">
          {children}
        </main>
      </div>
      <BottomTabBar />
    </div>
  );
}
