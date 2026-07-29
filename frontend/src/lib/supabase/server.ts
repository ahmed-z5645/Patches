import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { createTestServerClient, isTestMode } from "./test-mode";

export async function createClient() {
  const cookieStore = await cookies();

  if (isTestMode()) {
    return createTestServerClient(cookieStore) as unknown as ReturnType<typeof createServerClient>;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll can be called from a Server Component where cookies
            // can't be set. This can be safely ignored if middleware
            // refreshes the session.
          }
        },
      },
    }
  );
}
