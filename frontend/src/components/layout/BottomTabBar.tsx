"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
import { keys } from "@/lib/query-keys";

export function BottomTabBar() {
  const pathname = usePathname();
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    createClient()
      .auth.getUser()
      .then(({ data }: { data: { user: { user_metadata?: { username?: string } } | null } }) =>
        setUsername(data.user?.user_metadata?.username || null)
      );
  }, []);

  const { data: unreadData } = useQuery({
    queryKey: keys.notificationsUnreadCount(),
    queryFn: () => api.get<{ count: number }>("/api/notifications/unread-count"),
    staleTime: 60_000,
  });
  const unreadCount = unreadData?.count ?? 0;

  const tabs = [
    {
      href: "/feed",
      label: "Feed",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 11a9 9 0 0 1 9 9" />
          <path d="M4 4a16 16 0 0 1 16 16" />
          <circle cx="5" cy="19" r="1" />
        </svg>
      ),
    },
    {
      href: "/search",
      label: "Search",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      ),
    },
    {
      href: "/editor",
      label: "Create",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" />
          <line x1="5" y1="12" x2="19" y2="12" />
        </svg>
      ),
    },
    {
      href: "/notifications",
      label: "Notifications",
      badge: unreadCount > 0,
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
      ),
    },
    {
      href: username ? `/${username}` : "/settings",
      label: "Profile",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-primary bg-bg md:hidden">
      <div className="flex h-[80px] items-center justify-around">
        {tabs.map((tab) => {
          const isProfile = tab.label === "Profile" && username;
          const cls = cn(
            "relative flex size-10 items-center justify-center text-gray-400 transition-colors",
            pathname === tab.href && "text-accent"
          );
          const inner = (
            <>
              {tab.icon}
              {"badge" in tab && tab.badge && (
                <span className="absolute right-1 top-1 size-2 rounded-full bg-red-500" />
              )}
            </>
          );
          if (isProfile) {
            return (
              <a key={tab.label} href={tab.href} className={cls}>
                {inner}
              </a>
            );
          }
          return (
            <Link key={tab.label} href={tab.href} className={cls}>
              {inner}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
