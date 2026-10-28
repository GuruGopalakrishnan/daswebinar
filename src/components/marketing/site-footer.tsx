import Link from "next/link";
import { Logo } from "@/components/brand/logo";

// Only pages that exist. Contact, Terms and Privacy join the footer once their content is written (see the
// Phase 2 report): publishing placeholder legal text would be worse than none.
const COLUMNS = [
  {
    title: "Product",
    links: [
      ["Features", "/features"],
      ["How it works", "/how-it-works"],
      ["Pricing", "/pricing"],
    ],
  },
  {
    title: "Account",
    links: [
      ["Start free", "/signup"],
      ["Sign in", "/login"],
      ["Dashboard", "/dashboard"],
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t bg-card pt-12 pb-8">
      <div className="mx-auto w-full max-w-[1200px] px-4 md:px-6">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-[2fr_1fr_1fr]">
          <div className="col-span-2 grid content-start gap-3 md:col-span-1">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">
              Webinars for coaches, consultants, educators and creators in India. Host, engage and convert from one place.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <div key={col.title}>
              <h2 className="mb-3 text-[13px] font-semibold">{col.title}</h2>
              <ul className="text-sm">
                {col.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="block py-1 text-muted-foreground transition-colors hover:text-foreground">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
          <p>© Deploy &amp; Grow. Prices in ₹.</p>
          <p>webinar.deployandgrow.com</p>
        </div>
      </div>
    </footer>
  );
}
