import "server-only";
import { headers } from "next/headers";

/**
 * The public origin of this deployment, for links that leave the app (auth
 * emails, payment callbacks).
 *
 * Order: NEXT_PUBLIC_SITE_URL when it isn't localhost, then the host the
 * request actually came in on, then Vercel's production URL. Using the request
 * host means a deployment without NEXT_PUBLIC_SITE_URL still sends users back
 * to itself instead of to http://localhost:3000.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (configured && !isLocal(configured)) return configured;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto = h.get("x-forwarded-proto") ?? (isLocal(host) ? "http" : "https");
    return `${proto.split(",")[0]!.trim()}://${host.split(",")[0]!.trim()}`;
  }

  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  return configured || "http://localhost:3000";
}

function isLocal(value: string) {
  return /(^|\/\/)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(value);
}
