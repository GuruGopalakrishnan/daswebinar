import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";

const PROTECTED_PREFIXES = ["/dashboard", "/room", "/recordings", "/upgrade", "/onboarding"];
/** Guest (anonymous) sessions only reach attendee pages; these need a real account. */
const ACCOUNT_PREFIXES = ["/dashboard", "/upgrade", "/onboarding"];
const AUTH_PAGES = ["/login", "/signup"];
const PUBLIC_PATHS = ["/", "/pricing", "/features", "/how-it-works"];

/**
 * Refreshes the Supabase session cookie on every matched request and applies
 * coarse redirects. Pages and Server Functions must still check auth themselves.
 */
export async function updateSession(request: NextRequest) {
  // Public marketing pages never read the session. Skipping the auth round
  // trip keeps them fast and means a slow Supabase can't hold them up.
  if (PUBLIC_PATHS.includes(request.nextUrl.pathname)) return NextResponse.next({ request });

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabasePublishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it validates
  // the JWT and triggers the refresh that keeps users signed in.
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims);
  const hasAccount = isSignedIn && data?.claims.is_anonymous !== true;

  const { pathname } = request.nextUrl;

  if (!isSignedIn && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (isSignedIn && !hasAccount && ACCOUNT_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/signup";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  if (hasAccount && AUTH_PAGES.includes(pathname)) {
    const params = request.nextUrl.searchParams;
    const next = params.get("next");
    const target =
      params.get("plan") === "pro"
        ? "/upgrade?checkout=1"
        : next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
          ? next
          : "/dashboard";
    return NextResponse.redirect(new URL(target, request.nextUrl.origin));
  }

  // Friendly event links: answer unknown, private or draft slugs with a real HTTP 404 before the page starts
  // streaming (a streamed response can't change its status). Only a definite "no such public webinar"
  // rewrites; any other failure falls through and the page decides, as before.
  const eventSlug = /^\/e\/([^/]+)\/?$/.exec(pathname)?.[1];
  if (eventSlug !== undefined && !(await publicEventMayExist(supabase, eventSlug))) {
    const notFound = NextResponse.rewrite(new URL("/event-not-found", request.nextUrl.origin));
    // Keep the session refresh from getClaims() above.
    response.cookies.getAll().forEach((cookie) => notFound.cookies.set(cookie));
    response.headers.forEach((value, key) => {
      if (!key.startsWith("x-middleware-")) notFound.headers.set(key, value);
    });
    return notFound;
  }

  return response;
}

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/i;

/** False only when the slug can't belong to a public webinar: bad format, no match, or no slug support yet. */
async function publicEventMayExist(supabase: ReturnType<typeof createServerClient>, rawSlug: string) {
  let slug: string;
  try {
    slug = decodeURIComponent(rawSlug);
  } catch {
    return false;
  }
  if (slug.length > 64 || !SLUG.test(slug)) return false;
  const { data, error } = await supabase.rpc("get_public_webinar_by_slug", { p_slug: slug });
  // PGRST202: the slug migration isn't applied, so no slug can resolve (the page says the same).
  if (error) return error.code !== "PGRST202";
  return Array.isArray(data) && data.length > 0;
}
