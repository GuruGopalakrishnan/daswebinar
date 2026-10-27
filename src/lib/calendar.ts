// Calendar export helpers (ICS + Google Calendar link).

function stamp(iso: string) {
  return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

function escapeIcs(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

type CalendarEvent = { id: string; title: string; description: string; startsAt: string; durationMinutes: number; url: string };

function endIso(e: CalendarEvent) {
  return new Date(new Date(e.startsAt).getTime() + e.durationMinutes * 60_000).toISOString();
}

export function buildIcs(e: CalendarEvent) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Onstage//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${e.id}@webinar-clone`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.startsAt)}`,
    `DTEND:${stamp(endIso(e))}`,
    `SUMMARY:${escapeIcs(e.title)}`,
    `DESCRIPTION:${escapeIcs(`${e.description}\n\nJoin: ${e.url}`)}`,
    `URL:${e.url}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

export function downloadIcs(e: CalendarEvent) {
  const blob = new Blob([buildIcs(e)], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement("a"), { href: url, download: "webinar.ics" });
  a.click();
  URL.revokeObjectURL(url);
}

export function googleCalendarUrl(e: CalendarEvent) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: e.title,
    dates: `${stamp(e.startsAt)}/${stamp(endIso(e))}`,
    details: `${e.description}\n\nJoin: ${e.url}`.slice(0, 1500),
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
