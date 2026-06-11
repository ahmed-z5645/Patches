import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use a separate build dir in test mode so the Playwright `next dev` doesn't
  // collide with a developer's `npm run dev` on .next/dev/lock.
  ...(process.env.NEXT_PUBLIC_TEST_MODE === "1" ? { distDir: ".next-e2e" } : {}),
};

export default nextConfig;
