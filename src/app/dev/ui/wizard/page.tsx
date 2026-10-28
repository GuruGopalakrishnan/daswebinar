import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/dashboard/app-shell";
import { PageHeader } from "@/components/page-header";
import { WebinarForm } from "@/components/webinar/webinar-form";

export const metadata: Metadata = { title: "Wizard preview", robots: { index: false } };

/** DEVELOPMENT ONLY: the real create-webinar wizard without a session (submitting needs one). 404 in production. */
export default function WizardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <AppShell foot={null}>
      <div className="mx-auto w-full max-w-[1264px] px-4 py-7 md:px-8">
        <PageHeader
          className="mb-6"
          crumbs={[{ label: "Dashboard", href: "/dashboard" }, { label: "Create webinar" }]}
          title="Create a webinar"
          description="Five short steps. On the last one you can publish it or save it as a draft."
        />
        <WebinarForm />
      </div>
    </AppShell>
  );
}
