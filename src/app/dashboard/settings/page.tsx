import { redirect } from "next/navigation";

/** /dashboard/settings has one section so far. */
export default function SettingsIndex() {
  redirect("/dashboard/settings/profile");
}
