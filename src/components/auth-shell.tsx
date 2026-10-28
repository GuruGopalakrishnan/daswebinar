import { Logo } from "@/components/brand/logo";
import { Ticks } from "@/components/blocks/lists";

// The side panel only lists what the product does today.
const POINTS = ["Registration pages in minutes", "Personal join links, nothing to install", "Chat, Q&A and polls in one studio"];

/** Split layout for auth and onboarding: navy side panel on desktop, a single centred card on phones. */
export function AuthShell({ headline = "Host webinars your audience remembers.", children }: { headline?: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh flex-1 grid-cols-[minmax(0,1fr)] lg:grid-cols-2">
      <aside className="hidden flex-col justify-between gap-8 bg-primary p-12 text-primary-foreground lg:flex">
        <Logo inverted />
        <div className="flex max-w-[420px] flex-col gap-4">
          <p className="t-h1">{headline}</p>
          <Ticks items={POINTS} className="text-[15px] [&_svg]:text-[oklch(0.86_0.07_180)]" />
        </div>
        <p className="text-sm text-primary-foreground/70">webinar.deployandgrow.com</p>
      </aside>
      <main id="main" className="flex flex-col items-center px-4 pt-8 pb-12 sm:px-6 lg:justify-center lg:py-12">
        <div className="flex w-full max-w-[400px] flex-col gap-6">
          <div className="lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
