import { FREE_ATTENDEE_LIMIT } from "@/lib/billing/plans";

/** FAQ shown on the landing and pricing pages. Answers describe what the product does today. */
export const LANDING_FAQ = [
  {
    q: "Do my attendees need to download anything?",
    a: "No. Attendees join from the link in their confirmation email using Chrome, Edge, Safari or Firefox on a computer or phone. They don't need an account.",
  },
  {
    q: "What do I get on the Free plan?",
    a: `One webinar with up to ${FREE_ATTENDEE_LIMIT} attendees and the full studio: slides, screen sharing, chat, Q&A, polls and recording to your computer. Past webinars stay in your account whether you upgrade or stay on Free.`,
  },
  {
    q: "How do reminders work?",
    a: "Registrants get a confirmation email with their personal join link and a calendar invite, then reminders 24 hours and 1 hour before the start, and a “we're live” email when you go live.",
  },
  {
    q: "Can I cancel Pro?",
    a: "Yes, from Billing. Pro stays active until the end of the month you paid for, then your account moves to Free. Nothing is deleted.",
  },
  {
    q: "What happens if my internet is slow?",
    a: "Video quality adapts to each connection, and attendees on weak networks get a lighter stream. If a connection drops, the room reconnects automatically.",
  },
  {
    q: "What happens when my free webinar is full?",
    a: `New registrations stop at ${FREE_ATTENDEE_LIMIT} and visitors see that the webinar is full. Upgrade and registration opens again straight away.`,
  },
];
