import { AuthShell } from "@/components/auth-shell";

/** Auth screens: navy side panel on desktop, a single centred card on phones (logo on top). */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>;
}
