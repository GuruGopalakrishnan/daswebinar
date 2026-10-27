import "server-only";
import { NextResponse } from "next/server";
import { z } from "zod";
import type { PostgrestError, SupabaseClient, User } from "@supabase/supabase-js";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = () => new ApiError(404, "not_found", "Not found.");

function errorResponse(error: ApiError) {
  return NextResponse.json(
    { error: { code: error.code, message: error.message, details: error.details } },
    { status: error.status },
  );
}

/** Wraps a Route Handler so thrown ApiErrors become JSON responses. */
export function handler<C>(fn: (request: Request, ctx: C) => Promise<Response>) {
  return async (request: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(request, ctx);
    } catch (error) {
      if (error instanceof ApiError) return errorResponse(error);
      console.error("Unhandled API error", error);
      return errorResponse(new ApiError(500, "internal_error", "Something went wrong."));
    }
  };
}

/**
 * Parses a JSON body against a schema. Requiring application/json also blocks
 * cross-site form posts: browsers must preflight that content type, and we
 * never send CORS headers.
 */
export async function parseBody<S extends z.ZodType>(request: Request, schema: S) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "unsupported_media_type", "Send a JSON body.");
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body is not valid JSON.");
  }
  return parse(schema, raw);
}

export function parseQuery<S extends z.ZodType>(request: Request, schema: S) {
  return parse(schema, Object.fromEntries(new URL(request.url).searchParams));
}

export function parse<S extends z.ZodType>(schema: S, value: unknown): z.output<S> {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new ApiError(400, "validation_failed", "Invalid request.", z.flattenError(result.error));
  }
  return result.data;
}

/** Route ids are UUIDs; anything else can't exist, so answer 404 without a DB call. */
export function parseId(value: string) {
  const result = z.uuid().safeParse(value);
  if (!result.success) throw notFound();
  return result.data;
}

/** Guest (anonymous) sessions are rejected unless the endpoint is one attendees use. */
export async function requireApiUser(supabase: SupabaseClient, { allowGuest = false } = {}): Promise<User> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw new ApiError(401, "unauthorized", "Sign in to continue.");
  }
  if (!allowGuest && data.user.is_anonymous) {
    throw new ApiError(403, "account_required", "Create a free account to do that.");
  }
  return data.user;
}

// Exceptions raised by our SQL functions/triggers (errcode P0001).
const DOMAIN_ERRORS: Record<string, [number, string]> = {
  webinar_not_found: [404, "Not found."],
  registration_closed: [409, "Registration is closed for this webinar."],
  webinar_full: [409, "This webinar is full."],
  invalid_status_transition: [409, "That status change isn't allowed."],
  missing_required_answers: [400, "Please answer all required questions."],
  invalid_answers: [400, "One of your answers is too long."],
  plan_webinar_limit: [402, "The free plan includes one webinar. Upgrade to Pro for unlimited webinars."],
};

/** Maps a PostgREST error to an ApiError. Never leaks raw database messages. */
export function dbError(error: PostgrestError): ApiError {
  if (error.code === "P0001" && error.message in DOMAIN_ERRORS) {
    const [status, message] = DOMAIN_ERRORS[error.message];
    return new ApiError(status, error.message, message);
  }
  if (error.code === "23514" || error.code === "22P02" || error.code === "23502") {
    return new ApiError(400, "constraint_violation", "A value is out of range or invalid.");
  }
  if (error.code === "42501") {
    return new ApiError(403, "forbidden", "You can't do that.");
  }
  console.error("Database error", error);
  return new ApiError(500, "internal_error", "Something went wrong.");
}
