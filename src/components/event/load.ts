import "server-only";
import { getCurrentUser, isGuest } from "@/lib/auth";
import type { PublicWebinarDto } from "@/lib/webinars/dto";
import { getHostWebinar, getMyRegistration } from "@/lib/webinars/queries";
import type { EventViewProps } from "./event-view";

/**
 * What the public event page needs about the visitor, for /register/<id> and /e/<slug> alike.
 * The registration comes back only if the visitor owns it (RLS); hosts are detected through getHostWebinar.
 */
export async function loadEventPage(webinar: PublicWebinarDto, pagePath: string): Promise<EventViewProps> {
  const user = await getCurrentUser();
  const [registration, hosted] = user ? await Promise.all([getMyRegistration(webinar.id, user.id), getHostWebinar(webinar.id)]) : [null, null];
  // A guest session (anonymous, from an earlier registration) can join rooms but has no verified email,
  // so the form still asks for one.
  const account =
    user && !isGuest(user)
      ? { email: user.email ?? "", name: ((user.user_metadata?.full_name as string | undefined) ?? "").trim() }
      : null;
  return { webinar, registration, isHost: hosted !== null, account, hasSession: user !== null, pagePath };
}
