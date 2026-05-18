function normalizeBaseUrl(raw: string): string {
  const trimmed = raw.trim();
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

// Single source of truth for the API base URL. Tolerates a misconfigured
// NEXT_PUBLIC_API_URL that omits the scheme (otherwise the browser treats
// it as a relative path and requests hit the frontend origin) or has a
// trailing slash.
export const API_BASE_URL = normalizeBaseUrl(
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
);
