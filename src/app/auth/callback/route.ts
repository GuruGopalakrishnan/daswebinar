import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Landing point for Supabase email links (signup confirmation, magic link).
 * Handles both the PKCE `code` flow and the `token_hash` flow.
 *
 * Redirects are built from the public site URL, not the request origin, so a
 * deployment behind a proxy never sends people to an internal host.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeNextPath(searchParams.get("next"));
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const site = await getSiteUrl();

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    return NextResponse.redirect(new URL(error ? "/login?error=link" : next, site));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, site));
    // PKCE needs the cookie from the browser that signed up. Opened elsewhere
    // (e.g. on a phone), the exchange fails, but Supabase has already confirmed
    // the email before redirecting here, so ask them to log in.
    const login = new URL("/login", site);
    login.searchParams.set("verified", "1");
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  return NextResponse.redirect(new URL("/login?error=link", site));
}
