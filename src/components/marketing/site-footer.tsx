import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";

const COLUMNS = [
  { title: "Product", links: [["Why hosts switch", "/#benefits"], ["Pricing", "/#pricing"], ["FAQ", "/#faq"]] },
  { title: "Account", links: [["Start free", "/signup"], ["Log in", "/login"], ["Dashboard", "/dashboard"]] },
] as const;

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.6fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm text-muted-foreground">
            Live webinars that look premium and keep your audience engaged until the very last slide.
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
          © {BRAND.name}. All prices in Indian Rupees (₹).
        </p>
      </div>
    </footer>
  );
}
