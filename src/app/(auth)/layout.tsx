import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh flex-1 lg:grid-cols-2">
      <div className="flex flex-col">
        <header className="flex h-14 items-center justify-between px-6">
          <Logo />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-center justify-center px-6 py-10">
          <div className="w-full max-w-sm">{children}</div>
        </main>
      </div>

      <aside className="relative hidden overflow-hidden border-l bg-card lg:block" aria-hidden>
        <div className="bg-dots absolute inset-0 opacity-60" />
        <div className="absolute top-1/4 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/25 blur-[100px]" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <blockquote className="max-w-md">
            <p className="text-2xl font-medium tracking-tight text-balance">
              “The best webinars feel like conversations. Give your audience a voice — chat, questions, polls — and
              they&apos;ll stay to the end.”
            </p>
          </blockquote>
          <div className="mt-8 flex gap-2">
            {["Chat", "Q&A", "Polls", "Reactions", "Recordings"].map((t) => (
              <span key={t} className="rounded-full border bg-background/60 px-3 py-1 text-xs text-muted-foreground backdrop-blur">
                {t}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
