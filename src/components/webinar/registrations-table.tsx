"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Download, Loader2, Search, UserX, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/copy-button";
import { EmptyState } from "@/components/empty-state";
import { Input } from "@/components/ui/input";
import { UserAvatar } from "@/components/user-avatar";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/format";
import { useNow } from "@/hooks/use-client-values";
import type { CustomField } from "@/lib/webinars/schema";
import type { RegistrationDto } from "@/lib/webinars/dto";
import type { RegistrationStatus } from "@/lib/webinars/types";

const STATUS_STYLE: Record<RegistrationStatus, string> = {
  approved: "bg-success-subtle text-success ring-[color-mix(in_oklch,var(--success)_30%,transparent)]",
  pending: "bg-warning-subtle text-warning-text ring-[color-mix(in_oklch,var(--warning)_50%,transparent)]",
  rejected: "bg-destructive-subtle text-destructive ring-[color-mix(in_oklch,var(--destructive)_30%,transparent)]",
  cancelled: "bg-secondary text-muted-foreground ring-border",
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
      <div className="rounded-xl border border-border/85 bg-card shadow-card">
        <EmptyState icon={UserX} title="No registrations yet" description="Share your registration link to start filling seats." />
      </div>
    );
  }

  return (
    <div className="min-w-0 rounded-xl border border-border/85 bg-card shadow-card">
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
        <div className="flex gap-0.5 overflow-x-auto rounded-md bg-muted p-[3px] [scrollbar-width:none]" role="group" aria-label="Filter by status">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                "h-7 shrink-0 cursor-pointer rounded-[6px] px-2.5 text-xs font-medium capitalize transition-[background-color,color,box-shadow] duration-[180ms]",
                filter === f ? "bg-card text-foreground shadow-card" : "text-muted-foreground hover:text-foreground",
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
                    <span className={cn("inline-flex h-5 items-center rounded-full px-2 text-[11px] font-medium capitalize ring-1 ring-inset", STATUS_STYLE[r.status])}>
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
