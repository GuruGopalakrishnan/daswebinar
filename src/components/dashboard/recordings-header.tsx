import { Callout } from "@/components/blocks/callout";
import { PageHeader } from "@/components/page-header";

/** Title and sharing tip for the recordings page (also used by the /dev/ui/recordings preview). */
export function RecordingsHeader() {
  return (
    <div className="grid gap-5">
      <PageHeader title="Recordings" description="Sessions you recorded in this browser. They stay on this computer until you delete them." />
      <Callout tone="info" title="Sharing a replay">
        Save the file, upload it to a host that gives you a direct MP4 or WebM link, then paste that link in the
        webinar&apos;s Recordings tab. Approved registrants can watch it there.
      </Callout>
    </div>
  );
}
