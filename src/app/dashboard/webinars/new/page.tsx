import Link from "next/link";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { WebinarForm } from "@/components/webinar/webinar-form";

export const metadata: Metadata = { title: "New webinar" };

export default function NewWebinarPage() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <Link href="/dashboard" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="size-4" /> Dashboard
      </Link>
      <h1 className="mb-8 text-2xl font-semibold tracking-tight">Create a webinar</h1>
      <WebinarForm />
    </div>
  );
}
