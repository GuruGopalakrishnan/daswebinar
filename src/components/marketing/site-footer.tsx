import Link from "next/link";
import { Logo } from "@/components/brand/logo";

const COLUMNS = [
  { title: "Product", links: [["Features", "/#features"], ["Pricing", "/#pricing"], ["FAQ", "/#faq"]] },
  { title: "Get started", links: [["Create account", "/signup"], ["Log in", "/login"], ["Dashboard", "/dashboard"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Live webinars with real-time chat, Q&amp;A, polls and reactions — built for audiences that participate.
          </p>
        </div>
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-sm font-medium">{col.title}</h3>
            <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
              {col.links.map(([label, href]) => (
                <li key={href}>
                  <Link href={href} className="hover:text-foreground">
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t">
        <p className="mx-auto max-w-6xl px-4 py-6 text-xs text-muted-foreground sm:px-6">
          © Webinar Clone. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
