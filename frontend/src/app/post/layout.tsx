import { Sidebar } from "@/components/layout/Sidebar";
import { BottomTabBar } from "@/components/layout/BottomTabBar";
import { CountdownPill } from "@/components/layout/CountdownPill";

// Public route (outside the (app) group) so post permalinks are reachable
// without a session — access control is enforced by GET /api/posts/{id}.
export default function PostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-bg">
      <Sidebar />
      <div className="md:ml-[80px]">
        <header className="flex h-[80px] items-center justify-end border-b border-primary px-6 md:px-10">
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
