"use client";

import { useState, useEffect } from "react";

function getTimeUntilSunday(): string {
  const now = new Date();
  const daysUntilSunday = (7 - now.getUTCDay()) % 7 || 7;
  const nextSunday = new Date(now);
  nextSunday.setUTCDate(now.getUTCDate() + daysUntilSunday);
  nextSunday.setUTCHours(0, 0, 0, 0);

  const diff = nextSunday.getTime() - now.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days === 0) return `${hours} hours until a new week is revealed`;
  if (days === 1) return `1 day and ${hours} hours until a new week is revealed`;
  return `${days} days and ${hours} hours until a new week is revealed`;
}

export function CountdownPill() {
  const [text, setText] = useState("");

  useEffect(() => {
    setText(getTimeUntilSunday());
    const interval = setInterval(() => setText(getTimeUntilSunday()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (!text) return null;

  return (
    <div className="hidden rounded-[15px] bg-[#d9d9d9] px-6 py-3 text-[15px] font-normal md:block">
      {text}
    </div>
  );
}
