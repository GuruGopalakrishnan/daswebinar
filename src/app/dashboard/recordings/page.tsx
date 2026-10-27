import type { Metadata } from "next";
import { LocalRecordings } from "@/components/dashboard/local-recordings";

export const metadata: Metadata = { title: "Recordings" };

export default function RecordingsPage() {
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="font-display text-3xl tracking-tight">Recordings</h1>
      <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
        Sessions you recorded in this browser. They stay on this computer until you delete them. To share a replay, upload
        the file (YouTube unlisted, Google Drive, Vimeo) and add the link on the webinar&apos;s page.
      </p>
      <div className="mt-8">
        <LocalRecordings />
      </div>
    </div>
  );
}
