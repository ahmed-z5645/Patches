import { createBrowserClient } from "@supabase/ssr";
import { createTestBrowserClient, isTestMode } from "./test-mode";

export function createClient() {
  if (isTestMode()) {
    return createTestBrowserClient() as unknown as ReturnType<typeof createBrowserClient>;
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
