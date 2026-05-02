"use client";

import { useState, useEffect } from "react";

function getNextReveal(): Date {
  const now = new Date();
  // Map now into Eastern time by abusing the locale-string trick:
  // eastern is a Date whose local-time fields read as Eastern values.
  const eastern = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const offsetMs = eastern.getTime() - now.getTime();

  // Days until Monday (0 = today is Monday)
  const dayOfWeek = eastern.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  let daysUntilMonday = (1 - dayOfWeek + 7) % 7;
  if (daysUntilMonday === 0 && eastern.getHours() >= 9) {
    daysUntilMonday = 7; // already past 9 AM Monday — use next week
  }

  const targetEastern = new Date(eastern);
  targetEastern.setDate(eastern.getDate() + daysUntilMonday);
  targetEastern.setHours(9, 0, 0, 0);

  // Subtract the offset to convert "Eastern fake-local" back to true UTC
  return new Date(targetEastern.getTime() - offsetMs);
}

function getTimeUntilReveal(): string {
  const diff = getNextReveal().getTime() - Date.now();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days === 0) return `${hours} hours until a new week is revealed`;
  if (days === 1) return `1 day and ${hours} hours until a new week is revealed`;
  return `${days} days and ${hours} hours until a new week is revealed`;
}

export function CountdownPill() {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(getTimeUntilReveal());
    const interval = setInterval(() => setText(getTimeUntilReveal()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!text) return null;

  return (
    <div className="hidden rounded-[15px] bg-secondary px-6 py-3 text-[15px] font-normal md:block">
      {text}
    </div>
  );
}
