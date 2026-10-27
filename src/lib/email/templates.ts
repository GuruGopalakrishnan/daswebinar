import "server-only";
import { BRAND } from "@/lib/brand";
import { buildIcs } from "@/lib/calendar";
import { formatDate, formatDuration, formatTime } from "@/lib/format";
import type { OutgoingEmail } from "./resend";

export type EmailKind = "confirmation" | "reminder_24h" | "reminder_1h" | "live";

export type EmailContext = {
  to: string;
  attendeeName: string;
  joinUrl: string;
  webinar: {
    id: string;
    title: string;
    description: string | null;
    startsAt: string;
    durationMinutes: number;
    timezone: string;
    hostName: string | null;
  };
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function firstName(name: string) {
  return name.trim().split(/\s+/)[0] || "there";
}

type Copy = { subject: string; preheader: string; heading: string; intro: string; button: string };

function copy(kind: EmailKind, c: EmailContext): Copy {
  const title = c.webinar.title;
  const host = c.webinar.hostName ? ` with ${c.webinar.hostName}` : "";
  switch (kind) {
    case "confirmation":
      return {
        subject: `You're registered: ${title}`,
        preheader: `Your seat is saved. Here's your personal join link.`,
        heading: "Your seat is saved",
        intro: `You're registered for ${title}${host}. Add it to your calendar, and use the button below to join when it starts.`,
        button: "Your join link",
      };
    case "reminder_24h":
      return {
        subject: `Tomorrow: ${title}`,
        preheader: `${title} starts in about 24 hours.`,
        heading: "See you tomorrow",
        intro: `A quick reminder: ${title}${host} starts in about 24 hours.`,
        button: "Your join link",
      };
    case "reminder_1h":
      return {
        subject: `Starting in 1 hour: ${title}`,
        preheader: `Grab a coffee. We start in an hour.`,
        heading: "We start in one hour",
        intro: `${title}${host} starts in about an hour. Join a few minutes early to check your sound.`,
        button: "Join the webinar",
      };
    case "live":
      return {
        subject: `We're live now: ${title}`,
        preheader: `${title} has started. Join now.`,
        heading: "We're live!",
        intro: `${title}${host} has just started. Jump in now so you don't miss the beginning.`,
        button: "Join live now",
      };
  }
}

export function renderEmail(kind: EmailKind, c: EmailContext): OutgoingEmail {
  const t = copy(kind, c);
  const when = `${formatDate(c.webinar.startsAt, c.webinar.timezone)} · ${formatTime(c.webinar.startsAt, c.webinar.timezone)}`;
  const duration = formatDuration(c.webinar.durationMinutes);
  const hello = `Hi ${firstName(c.attendeeName)},`;
  const live = kind === "live";
  const accent = live ? "#e11d48" : "#4f46e5";

  const text = [
    hello,
    "",
    t.intro,
    "",
    `${c.webinar.title}`,
    `${when} (${duration})`,
    "",
    `${t.button}: ${c.joinUrl}`,
    "",
    "This link is personal to you. Please don't forward it.",
    "",
    `You're receiving this because you registered for ${c.webinar.title}.`,
    BRAND.name,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(t.subject)}</title></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#18181b;">
<span style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(t.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 16px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
<tr><td style="padding:28px 32px 0;font-size:15px;font-weight:700;letter-spacing:-0.01em;">${escapeHtml(BRAND.name)}</td></tr>
<tr><td style="padding:24px 32px 0;">
${live ? `<span style="display:inline-block;background:#ffe4e6;color:#e11d48;font-size:12px;font-weight:700;padding:4px 10px;border-radius:999px;">● LIVE NOW</span>` : ""}
<h1 style="margin:${live ? "14px" : "0"} 0 0;font-size:24px;line-height:1.25;letter-spacing:-0.02em;">${escapeHtml(t.heading)}</h1>
<p style="margin:16px 0 0;font-size:15px;line-height:1.6;color:#3f3f46;">${escapeHtml(hello)}</p>
<p style="margin:8px 0 0;font-size:15px;line-height:1.6;color:#3f3f46;">${escapeHtml(t.intro)}</p>
</td></tr>
<tr><td style="padding:24px 32px 0;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;border-radius:12px;">
<tr><td style="padding:16px 18px;">
<div style="font-size:16px;font-weight:600;line-height:1.4;">${escapeHtml(c.webinar.title)}</div>
<div style="margin-top:6px;font-size:14px;color:#52525b;">${escapeHtml(when)}</div>
<div style="margin-top:2px;font-size:14px;color:#52525b;">${escapeHtml(duration)}${c.webinar.hostName ? ` · Hosted by ${escapeHtml(c.webinar.hostName)}` : ""}</div>
</td></tr>
</table>
</td></tr>
<tr><td style="padding:24px 32px 0;">
<a href="${escapeHtml(c.joinUrl)}" style="display:block;background:${accent};color:#ffffff;text-decoration:none;text-align:center;font-size:16px;font-weight:600;padding:14px 20px;border-radius:10px;">${escapeHtml(t.button)} →</a>
<p style="margin:12px 0 0;font-size:12px;line-height:1.5;color:#71717a;text-align:center;">This link is personal to you. Please don't forward it.</p>
</td></tr>
<tr><td style="padding:28px 32px 28px;">
<hr style="border:none;border-top:1px solid #e4e4e7;margin:0 0 16px;">
<p style="margin:0;font-size:12px;line-height:1.5;color:#a1a1aa;">You're receiving this because you registered for ${escapeHtml(c.webinar.title)}.</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const email: OutgoingEmail = { to: c.to, subject: t.subject, html, text };

  if (kind === "confirmation") {
    email.attachments = [
      {
        filename: "webinar.ics",
        contentType: "text/calendar; charset=utf-8; method=PUBLISH",
        content: buildIcs({
          id: c.webinar.id,
          title: c.webinar.title,
          description: c.webinar.description ?? "",
          startsAt: c.webinar.startsAt,
          durationMinutes: c.webinar.durationMinutes,
          url: c.joinUrl,
        }),
      },
    ];
  }
  return email;
}
