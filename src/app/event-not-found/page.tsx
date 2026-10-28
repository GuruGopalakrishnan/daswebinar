import type { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = { title: "Event not found", robots: { index: false } };

/**
 * Static 404 for unknown event slugs. The proxy rewrites /e/<unknown> here before anything streams, and a page
 * that calls notFound() while prerendering is served with HTTP 404. Not linked anywhere.
 */
export default function EventNotFoundPage() {
  notFound();
}
