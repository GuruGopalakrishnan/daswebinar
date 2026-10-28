/** Title + one line of context at the top of an auth card. */
export function AuthHeading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <h1 className="t-h2">{title}</h1>
      {children && <p className="text-pretty text-muted-foreground">{children}</p>}
    </div>
  );
}

export const authLinkClass = "font-medium text-teal underline-offset-4 hover:underline";
