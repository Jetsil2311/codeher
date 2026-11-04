import { NextResponse, type NextRequest } from "next/server";
import { staffClient } from "@/server/supabase";

// Google sign-in and email confirmation links land here with a one-time code.
// Exchanging it sets the Supabase Auth cookies, then the staff area takes over.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const raw = url.searchParams.get("next") ?? "/equipo/panel";
  const next = raw.startsWith("/") && !raw.startsWith("//") ? raw : "/equipo/panel";
  if (code) {
    const c = await staffClient();
    const { error } = await c.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }
  return NextResponse.redirect(new URL("/equipo?error=auth", url.origin));
}
