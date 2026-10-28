"use client";

import { useMounted } from "@/hooks/use-client-values";
import { formatDate, formatTime } from "@/lib/format";
import { browserTimeZone } from "@/lib/time";

/** Shows the start in the viewer's time zone (after mount), falling back to the webinar's zone. */
export function LocalTime({ iso, webinarTimeZone }: { iso: string; webinarTimeZone: string }) {
  const mounted = useMounted();
  const zone = mounted ? browserTimeZone() : webinarTimeZone;
  // Compare the shown times, not zone names: Asia/Calcutta and Asia/Kolkata are the same zone.
  const differs = mounted && formatTime(iso, zone) !== formatTime(iso, webinarTimeZone);

  return (
    <div>
      <p className="font-medium">{formatDate(iso, zone)}</p>
      <p className="text-sm text-muted-foreground">
        {formatTime(iso, zone)}
        {differs && <span className="block text-xs">Host time: {formatTime(iso, webinarTimeZone)}</span>}
      </p>
    </div>
  );
}
