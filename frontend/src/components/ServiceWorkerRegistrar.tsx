"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return view;
}

function keyToBase64(key: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(key)));
}

async function subscribeToPush(registration: ServiceWorkerRegistration) {
  if (!VAPID_PUBLIC_KEY || !("PushManager" in window)) return;

  const { data } = await createClient().auth.getUser();
  if (!data.user) return;

  try {
    const existing = await registration.pushManager.getSubscription();
    const sub =
      existing ??
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      }));

    await api.post("/api/push/subscribe", {
      endpoint: sub.endpoint,
      keys: {
        p256dh: keyToBase64(sub.getKey("p256dh")!),
        auth: keyToBase64(sub.getKey("auth")!),
      },
    });
  } catch {
    // Permission denied or push unsupported — silently skip
  }
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").then((registration) => {
      subscribeToPush(registration);
    });
  }, []);

  return null;
}
