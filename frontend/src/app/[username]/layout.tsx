import { Sidebar } from "@/components/layout/Sidebar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { CountdownPill } from "@/components/layout/CountdownPill";

export default function PublicProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <div className="md:ml-[80px]">
        <header className="flex h-[80px] items-center justify-between border-b border-primary px-6 md:px-10">
          <div className="flex items-center gap-3">
            <div className="size-[35px] rounded-full bg-primary" />
            <span className="text-[25px]">profile</span>
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
