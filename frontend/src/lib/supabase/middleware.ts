import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { TEST_USER_COOKIE, isTestMode } from "./test-mode";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  // Test-mode short circuit: treat the edition_test_user cookie as a signed-in
  // user so the protected/auth route logic below runs without contacting
  // Supabase Auth (which doesn't exist in test mode).
  let user: { id: string } | null = null;
  if (isTestMode()) {
    const token = request.cookies.get(TEST_USER_COOKIE)?.value;
    user = token ? { id: token } : null;
  } else {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) =>
              request.cookies.set(name, value)
            );
            supabaseResponse = NextResponse.next({ request });
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            );
          },
        },
      }
    );
    const res = await supabase.auth.getUser();
    user = res.data.user;
  }

  const pathname = request.nextUrl.pathname;

  const authRoutes = ["/login", "/signup", "/callback"];
  const protectedRoutes = ["/feed", "/editor", "/archive", "/settings"];

  if (user && authRoutes.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone();
    url.pathname = "/feed";
    return NextResponse.redirect(url);
  }

  if (!user && protectedRoutes.some((r) => pathname.startsWith(r))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
