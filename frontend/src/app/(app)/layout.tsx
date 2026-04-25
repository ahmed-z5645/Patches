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

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <div className="md:ml-[80px]">
        <header className="flex h-[80px] items-center justify-between border-b border-[#d9d9d9] px-6 md:px-10">
          <div className="flex items-center gap-3">
            <div className="size-[50px] rounded-full bg-[#d9d9d9]" />
            <span className="text-[25px]">
              {user.user_metadata?.username || "scrapp"}
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
