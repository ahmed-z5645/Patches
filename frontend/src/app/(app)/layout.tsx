import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { CountdownPill } from "@/components/layout/CountdownPill";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("avatar_color")
    .eq("id", user.id)
    .single();

  const avatarColor = profile?.avatar_color || "#223843";

  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <div className="md:ml-[80px]">
        <header className="flex h-[80px] items-center justify-between border-b border-primary px-6 md:px-10">
          <div className="flex items-center gap-3">
            <div className="size-[35px] rounded-full" style={{ backgroundColor: avatarColor }} />
            <span className="text-[25px]">
              <h1>@{user.user_metadata?.username || "edition"}</h1>
            </span>
          </div>
          <CountdownPill />
        </header>
        <main className="px-6 py-6 pb-[100px] md:px-10 md:pb-6">
          {children}
        </main>
      </div>
      <BottomTabBar />
    </div>
  );
}
