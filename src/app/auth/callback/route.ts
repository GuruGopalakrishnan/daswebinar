import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { RESET_PASSWORD_PATH, safeNextPath } from "@/lib/auth";
import { getSiteUrl } from "@/lib/site-url";

/**
 * Landing point for Supabase email links (signup confirmation, magic link,
 * password reset). Handles both the PKCE `code` flow and the `token_hash` flow.
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
  const isReset = type === "recovery" || next.startsWith(RESET_PASSWORD_PATH);
  // A failed reset link goes back to "forgot password" (to request a new one), not to the login page.
  const failed = () => NextResponse.redirect(new URL(isReset ? "/forgot-password?error=link" : "/login?error=link", site));

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (error) return failed();
    return NextResponse.redirect(new URL(type === "recovery" ? RESET_PASSWORD_PATH : next, site));
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, site));
    // PKCE needs the cookie from the browser that started the flow. A reset
    // link opened elsewhere can't work, so ask for a new one in this browser.
    if (isReset) return failed();
    // A signup confirmation opened elsewhere (e.g. on a phone): Supabase has
    // already confirmed the email before redirecting here, so ask them to log in.
    const login = new URL("/login", site);
    login.searchParams.set("verified", "1");
    login.searchParams.set("next", next);
    return NextResponse.redirect(login);
  }

  return failed();
}
