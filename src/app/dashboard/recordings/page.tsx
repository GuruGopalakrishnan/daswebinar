import type { Metadata } from "next";
import { LocalRecordings } from "@/components/dashboard/local-recordings";
import { RecordingsHeader } from "@/components/dashboard/recordings-header";

export const metadata: Metadata = { title: "Recordings" };

export default function RecordingsPage() {
  return (
    <div className="mx-auto w-full max-w-[1100px] px-4 py-7 md:px-8">
      <RecordingsHeader />
      <div className="mt-6">
        <LocalRecordings />
      </div>
    </div>
  );
}
