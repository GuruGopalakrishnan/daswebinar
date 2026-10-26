// Supabase access-token verification and per-webinar access checks.

import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { createClient } from "@supabase/supabase-js";
import type { Role } from "./protocol.ts";

export type AuthUser = {
  id: string;
  email: string | null;
  name: string;
  token: string;
  /** Epoch milliseconds. */
  expiresAt: number;
};

export type VerifyToken = (token: string) => Promise<AuthUser>;
export type ResolveAccess = (user: AuthUser, webinarId: string) => Promise<Role | null>;

type SupabaseClaims = JWTPayload & {
  email?: string;
  role?: string;
  user_metadata?: { full_name?: unknown };
};

function displayName(claims: SupabaseClaims): string {
  const fullName = claims.user_metadata?.full_name;
  if (typeof fullName === "string" && fullName.trim()) return fullName.trim().slice(0, 100);
  if (claims.email) return claims.email.split("@")[0]!.slice(0, 100);
  return "Guest";
}

/**
 * Verifies Supabase access tokens against the project's JWKS (asymmetric
 * signing keys). Rejects anon/service tokens: only signed-in users connect.
 */
export function createTokenVerifier(supabaseUrl: string): VerifyToken {
  const issuer = `${supabaseUrl}/auth/v1`;
  const jwks = createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`));

  return async (token) => {
    const { payload } = await jwtVerify<SupabaseClaims>(token, jwks, {
      issuer,
      audience: "authenticated",
      algorithms: ["ES256", "RS256"],
    });
    if (!payload.sub || payload.role !== "authenticated" || !payload.exp) {
      throw new Error("Not a user access token");
    }
    return {
      id: payload.sub,
      email: payload.email ?? null,
      name: displayName(payload),
      token,
      expiresAt: payload.exp * 1000,
    };
  };
}

/**
 * Decides whether a user may join a webinar room, using the user's own token
 * so the database's RLS rules make the decision:
 *   - host: the webinar row is visible to them (host-only RLS) and not cancelled
 *   - attendee: they have an approved registration and the webinar is
 *     scheduled or live
 */
export function createAccessResolver(supabaseUrl: string, supabaseKey: string): ResolveAccess {
  return async (user, webinarId) => {
    const db = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: `Bearer ${user.token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const owned = await db.from("webinars").select("status").eq("id", webinarId).maybeSingle();
    if (owned.error) throw owned.error;
    if (owned.data) return owned.data.status === "cancelled" ? null : "host";

    const registration = await db
      .from("registrations")
      .select("status")
      .eq("webinar_id", webinarId)
      .eq("user_id", user.id)
      .maybeSingle();
    if (registration.error) throw registration.error;
    if (registration.data?.status !== "approved") return null;

    const webinar = await db.rpc("get_public_webinar", { p_webinar_id: webinarId });
    if (webinar.error) throw webinar.error;
    const status = (webinar.data as { status: string }[] | null)?.[0]?.status;
    return status === "scheduled" || status === "live" ? "attendee" : null;
  };
}
