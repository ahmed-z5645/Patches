import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function LandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/feed");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <h1 className="text-[64px] font-normal leading-tight">Scrapp</h1>
      <p className="mt-4 max-w-md text-center text-gray-500">
        Document your week. Unlock your feed. Build your legacy.
      </p>
      <div className="mt-8 flex gap-4">
        <Link
          href="/signup"
          className="rounded-[15px] bg-black px-8 py-3 text-sm font-medium text-white hover:bg-gray-900"
        >
          Get started
        </Link>
        <Link
          href="/login"
          className="rounded-[15px] border border-[#d9d9d9] px-8 py-3 text-sm font-medium hover:bg-gray-50"
        >
          Sign in
        </Link>
      </div>
    </div>
  );
}
