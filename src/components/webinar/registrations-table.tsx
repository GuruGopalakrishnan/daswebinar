"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Download, Loader2, Search, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { useNow } from "@/hooks/use-client-values";
import type { CustomField } from "@/lib/webinars/schema";
import type { RegistrationDto } from "@/lib/webinars/dto";
import type { RegistrationStatus } from "@/lib/webinars/types";

const STATUS_STYLE: Record<RegistrationStatus, string> = {
  approved: "bg-success/12 text-success ring-success/25",
  pending: "bg-warning/12 text-warning ring-warning/30",
  rejected: "bg-destructive/10 text-destructive ring-destructive/25",
  cancelled: "bg-muted text-muted-foreground ring-border",
};

const FILTERS: ("all" | RegistrationStatus)[] = ["all", "pending", "approved", "rejected", "cancelled"];

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function RegistrationsTable({
  webinarId,
  registrations,
  fields,
}: {
  webinarId: string;
  registrations: RegistrationDto[];
  fields: CustomField[];
}) {
  const router = useRouter();
  const now = useNow();
  const [rows, setRows] = useState(registrations);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>(
    registrations.some((r) => r.status === "pending") ? "pending" : "all",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (filter === "all" || r.status === filter) &&
        (!q || r.fullName.toLowerCase().includes(q) || r.email.toLowerCase().includes(q)),
    );
  }, [rows, query, filter]);

  async function setStatus(r: RegistrationDto, status: RegistrationStatus) {
    setBusy(r.id);
    try {
      const res = await fetch(`/api/webinars/${webinarId}/registrations/${r.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error();
      setRows((all) => all.map((x) => (x.id === r.id ? { ...x, status } : x)));
      toast.success(`${r.fullName} ${status}`);
      router.refresh();
    } catch {
      toast.error("Couldn't update this registration.");
    } finally {
      setBusy(null);
    }
  }

  function exportCsv() {
    const header = ["Name", "Email", "Status", "Registered at", ...fields.map((f) => f.label)];
    const lines = rows.map((r) =>
      [r.fullName, r.email, r.status, r.createdAt, ...fields.map((f) => String(r.answers[f.id] ?? ""))]
        .map(csvEscape)
        .join(","),
    );
    const blob = new Blob([[header.map(csvEscape).join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: `registrations-${webinarId}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  }

  if (registrations.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed px-6 py-14 text-center">
        <UserX className="size-6 text-muted-foreground" />
        <p className="font-medium">No registrations yet</p>
        <p className="text-sm text-muted-foreground">Share your registration link to start filling seats.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card">
      <div className="flex flex-col gap-2 border-b p-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search registrations"
            className="pl-8"
          />
        </div>
        <div className="flex gap-1 overflow-x-auto scrollbar-thin">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1 text-xs capitalize transition-colors",
                filter === f ? "bg-accent font-medium" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f} <span className="tabular-nums opacity-60">{f === "all" ? rows.length : rows.filter((r) => r.status === f).length}</span>
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download /> CSV
        </Button>
      </div>

      <ul className="divide-y">
        {visible.map((r) => {
          const hasAnswers = fields.some((f) => r.answers[f.id] !== undefined && r.answers[f.id] !== "");
          const open = expanded === r.id;
          return (
            <li key={r.id} className="px-3 py-3">
              <div className="flex items-center gap-3">
                <UserAvatar name={r.fullName} id={r.email} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{r.fullName}</span>
                    <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] capitalize ring-1 ring-inset", STATUS_STYLE[r.status])}>
                      {r.status}
                    </span>
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {r.email}
                    {now !== null && <> · {formatRelative(r.createdAt, now)}</>}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {busy === r.id ? (
                    <Loader2 className="size-4 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      {r.status !== "approved" && (
                        <Button size="sm" variant="outline" onClick={() => setStatus(r, "approved")} aria-label={`Approve ${r.fullName}`}>
                          <Check /> <span className="hidden sm:inline">Approve</span>
                        </Button>
                      )}
                      {r.status !== "rejected" && r.status !== "cancelled" && (
                        <Button size="sm" variant="ghost" onClick={() => setStatus(r, "rejected")} aria-label={`Reject ${r.fullName}`}>
                          <X /> <span className="hidden sm:inline">Reject</span>
                        </Button>
                      )}
                    </>
                  )}
                  {r.status === "approved" && (
                    <CopyButton
                      value={`/join/${r.joinToken}`}
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Copy ${r.fullName}'s join link`}
                      title="Copy personal join link"
                      label=""
                    />
                  )}
                  {hasAnswers && (
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-expanded={open}
                      aria-label="Show answers"
                      onClick={() => setExpanded(open ? null : r.id)}
                    >
                      <ChevronDown className={cn("transition-transform", open && "rotate-180")} />
                    </Button>
                  )}
                </div>
              </div>
              {open && (
                <dl className="mt-3 ml-11 grid gap-2 rounded-lg bg-muted/40 p-3 text-sm sm:grid-cols-2">
                  {fields.map((f) => (
                    <div key={f.id}>
                      <dt className="text-xs text-muted-foreground">{f.label}</dt>
                      <dd className="break-words">
                        {typeof r.answers[f.id] === "boolean" ? (r.answers[f.id] ? "Yes" : "No") : String(r.answers[f.id] ?? "—")}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </li>
          );
        })}
        {visible.length === 0 && <li className="px-3 py-10 text-center text-sm text-muted-foreground">No matches.</li>}
      </ul>
    </div>
  );
}
