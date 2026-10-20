import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { destinationAfterSignIn } from "@/lib/auth/post-signin";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  if (searchParams.get("error") || !code) redirect("/login?error=link");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    console.error("[auth] code exchange failed:", error.message);
    redirect("/login?error=link");
  }
  redirect(await destinationAfterSignIn(data.session, searchParams.get("next")));
}
