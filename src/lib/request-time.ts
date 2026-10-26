import "server-only";
import { connection } from "next/server";

/**
 * The current time for a dynamic (per-request) server render. Awaiting
 * connection() marks the render as request-time, so the value is never baked
 * into a prerendered page.
 */
export async function requestTime(): Promise<number> {
  await connection();
  return Date.now();
}
