"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  CalendarDays,
  Copy,
  ExternalLink,
  MoreHorizontal,
  Plus,
  Radio,
  Settings2,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/webinar/status-badge";
import { cn } from "@/lib/utils";
import type { WebinarStatus } from "@/lib/webinars/types";

export type WebinarListItem = {
  id: string;
  title: string;
  status: WebinarStatus;
  startsAt: string;
  whenLabel: string;
  monthLabel: string;
  dayLabel: string;
  relativeLabel: string;
  registrationCount: number;
  capacity: number | null;
  isPast: boolean;
};

const FILTERS = [
  { id: "upcoming", label: "Upcoming" },
  { id: "live", label: "Live" },
  { id: "draft", label: "Drafts" },
  { id: "past", label: "Past" },
  { id: "all", label: "All" },
] as const;
type FilterId = (typeof FILTERS)[number]["id"];

function matches(item: WebinarListItem, filter: FilterId) {
  switch (filter) {
    case "upcoming":
      return item.status === "scheduled" && !item.isPast;
    case "live":
      return item.status === "live";
    case "draft":
      return item.status === "draft";
    case "past":
      return item.status === "ended" || item.status === "cancelled" || (item.status === "scheduled" && item.isPast);
    default:
      return true;
  }
}

export function WebinarList({ items }: { items: WebinarListItem[] }) {
  const initial: FilterId = items.some((i) => i.status === "live") ? "live" : "upcoming";
  const [filter, setFilter] = useState<FilterId>(initial);
  const [pendingDelete, setPendingDelete] = useState<WebinarListItem | null>(null);
  const [deleting, startDelete] = useTransition();
  const router = useRouter();

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.id, items.filter((i) => matches(i, f.id)).length])),
    [items],
  );
  const visible = items.filter((i) => matches(i, filter));
  // Past webinars read best newest-first.
  if (filter === "past" || filter === "all") visible.reverse();

  function remove(item: WebinarListItem) {
    startDelete(async () => {
      const res = await fetch(`/api/webinars/${item.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(`Deleted “${item.title}”`);
        setPendingDelete(null);
        router.refresh();
      } else {
        toast.error("Couldn't delete this webinar.");
      }
    });
  }

  async function copyLink(id: string) {
    await navigator.clipboard.writeText(`${window.location.origin}/register/${id}`);
    toast.success("Registration link copied");
  }

  return (
    <div className="min-w-0">
      <div className="flex gap-1 overflow-x-auto border-b px-2 [scrollbar-width:none] md:px-4" role="tablist" aria-label="Filter webinars">
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                "relative flex shrink-0 cursor-pointer items-center gap-1.5 px-3 py-2.5 text-sm font-medium transition-colors duration-[180ms] focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label}
              <span className="rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">{counts[f.id]}</span>
              {active && (
                <motion.span
                  layoutId="webinar-filter"
                  className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-teal"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
                />
              )}
            </button>
          );
        })}
      </div>

      {visible.length === 0 ? (
        <ListEmptyState filter={filter} />
      ) : (
        <ul className="divide-y">
          <AnimatePresence initial={false}>
            {visible.map((item) => (
              <motion.li
                key={item.id}
                layout
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="group relative flex items-center gap-4 px-4 py-3.5 transition-colors duration-[220ms] hover:bg-[color-mix(in_oklch,var(--accent)_60%,transparent)] has-[a:focus-visible]:outline-2 has-[a:focus-visible]:-outline-offset-2 has-[a:focus-visible]:outline-ring md:px-6"
              >
                <div aria-hidden className="flex size-12 shrink-0 flex-col items-center justify-center rounded-md border bg-card md:size-14">
                  <span className="text-[11px] tracking-[.06em] text-muted-foreground uppercase">{item.monthLabel}</span>
                  <span className="text-lg leading-[22px] font-semibold">{item.dayLabel}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/webinars/${item.id}`}
                      className="truncate font-semibold after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {item.title}
                    </Link>
                    <StatusBadge status={item.status} className="max-sm:hidden" />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <StatusBadge status={item.status} className="sm:hidden" />
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="size-3.5" /> {item.whenLabel}
                    </span>
                    <span>{item.relativeLabel}</span>
                    <span className="inline-flex items-center gap-1">
                      <Users className="size-3.5" />
                      {item.registrationCount}
                      {item.capacity ? ` / ${item.capacity}` : ""} registered
                    </span>
                  </div>
                </div>

                <div className="relative z-10 flex items-center gap-1">
                  {item.status === "live" && (
                    <Button asChild size="sm" className="bg-live text-white hover:bg-live/90">
                      <Link href={`/room/${item.id}`}>
                        <Radio /> Enter
                      </Link>
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${item.title}`}>
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-52">
                      <DropdownMenuItem asChild>
                        <Link href={`/dashboard/webinars/${item.id}`}>
                          <Settings2 /> Manage
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href={`/room/${item.id}`}>
                          <Video /> Open room
                        </Link>
                      </DropdownMenuItem>
                      {item.status !== "draft" && (
                        <>
                          <DropdownMenuItem onSelect={() => copyLink(item.id)}>
                            <Copy /> Copy registration link
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/register/${item.id}`} target="_blank">
                              <ExternalLink /> View registration page
                            </Link>
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem variant="destructive" onSelect={() => setPendingDelete(item)}>
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}

      <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this webinar?</AlertDialogTitle>
            <AlertDialogDescription>
              “{pendingDelete?.title}” and all of its registrations and recordings will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                if (pendingDelete) remove(pendingDelete);
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ListEmptyState({ filter }: { filter: FilterId }) {
  const copy: Record<FilterId, string> = {
    upcoming: "No upcoming webinars yet.",
    live: "Nothing is live right now.",
    draft: "No drafts.",
    past: "No past webinars yet.",
    all: "You haven't created a webinar yet.",
  };
  return (
    <EmptyState
      icon={Video}
      title={copy[filter]}
      action={
        <Button asChild size="sm">
          <Link href="/dashboard/webinars/new">
            <Plus /> Create webinar
          </Link>
        </Button>
      }
    />
  );
}
