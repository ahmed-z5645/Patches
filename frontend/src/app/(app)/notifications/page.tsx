"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { NotificationsSkeleton } from "@/components/notifications/NotificationsSkeleton";

interface Actor {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
}

interface Notification {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  is_read: boolean;
  created_at: string;
  actor: Actor | null;
}

interface FollowRequest {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  avatar_color: string | null;
}

const DEFAULT_AVATAR_COLOR = "#223843";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function notificationText(type: string): string {
  switch (type) {
    case "new_follower":
      return "started following you";
    case "follow_accepted":
      return "accepted your follow request";
    case "follow_request":
      return "requested to follow you";
    default:
      return "";
  }
}

export default function NotificationsPage() {
  const [requests, setRequests] = useState<FollowRequest[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [reqs, notifs] = await Promise.all([
          api.get<FollowRequest[]>("/api/follows/requests"),
          api.get<Notification[]>("/api/notifications"),
        ]);
        setRequests(reqs);
        setNotifications(notifs.filter((n) => n.type !== "follow_request"));
        api.post("/api/notifications/read-all");
      } catch (e) {
        console.error("Failed to load notifications:", e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleAccept = useCallback(async (followerId: string) => {
    setActionLoading(followerId);
    try {
      await api.post(`/api/follows/requests/${followerId}/accept`);
      setRequests((prev) => prev.filter((r) => r.id !== followerId));
    } catch (e) {
      console.error("Failed to accept:", e);
    } finally {
      setActionLoading(null);
    }
  }, []);

  const handleReject = useCallback(async (followerId: string) => {
    setActionLoading(followerId);
    try {
      await api.post(`/api/follows/requests/${followerId}/reject`);
      setRequests((prev) => prev.filter((r) => r.id !== followerId));
    } catch (e) {
      console.error("Failed to reject:", e);
    } finally {
      setActionLoading(null);
    }
  }, []);

  if (loading) {
    return <NotificationsSkeleton />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="font-[family-name:var(--font-cabinet)] text-[48px] font-bold leading-tight md:text-[64px]">
        Notifications
      </h1>

      {requests.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-[family-name:var(--font-cabinet)] text-xl font-bold">
            Follow Requests
          </h2>
          <div className="space-y-2">
            {requests.map((req) => (
              <div
                key={req.id}
                className="flex items-center justify-between rounded-[15px] border border-primary p-4"
              >
                <Link
                  href={`/${req.username}`}
                  className="flex items-center gap-3"
                >
                  <div
                    className="size-10 rounded-full"
                    style={{ backgroundColor: req.avatar_color || DEFAULT_AVATAR_COLOR }}
                  />
                  <div>
                    <p className="text-sm font-medium">
                      {req.display_name || req.username}
                    </p>
                    <p className="text-xs text-text/40">@{req.username}</p>
                  </div>
                </Link>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAccept(req.id)}
                    disabled={actionLoading === req.id}
                    className="rounded-[10px] bg-text px-4 py-1.5 text-sm font-medium text-bg hover:bg-text/90 disabled:opacity-50"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() => handleReject(req.id)}
                    disabled={actionLoading === req.id}
                    className="rounded-[10px] border border-primary px-4 py-1.5 text-sm text-text/60 hover:border-text/40 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-3">
        {requests.length > 0 && (
          <h2 className="font-[family-name:var(--font-cabinet)] text-xl font-bold">
            Activity
          </h2>
        )}

        {notifications.length === 0 && requests.length === 0 ? (
          <p className="py-10 text-center text-sm text-text/40">
            No notifications yet.
          </p>
        ) : notifications.length === 0 ? null : (
          <div className="space-y-1">
            {notifications.map((notif) => (
              <div
                key={notif.id}
                className={`flex items-center gap-3 rounded-[15px] p-4 ${
                  !notif.is_read ? "bg-primary/20" : ""
                }`}
              >
                <Link href={`/${notif.actor?.username || ""}`}>
                  <div
                    className="size-10 shrink-0 rounded-full"
                    style={{ backgroundColor: notif.actor?.avatar_color || DEFAULT_AVATAR_COLOR }}
                  />
                </Link>
                <div className="flex-1 text-sm">
                  <Link
                    href={`/${notif.actor?.username || ""}`}
                    className="font-medium hover:text-accent"
                  >
                    {notif.actor?.display_name || notif.actor?.username || "Someone"}
                  </Link>{" "}
                  <span className="text-text/60">
                    {notificationText(notif.type)}
                  </span>
                </div>
                <span className="shrink-0 text-xs text-text/30">
                  {timeAgo(notif.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
