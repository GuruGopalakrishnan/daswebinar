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
    <div className="min-w-0 rounded-xl border bg-card shadow-card">
      <div className="flex items-center gap-1 overflow-x-auto border-b p-2 scrollbar-thin" role="tablist" aria-label="Filter webinars">
        {FILTERS.map((f) => {
          const active = f.id === filter;
          return (
            <button
              key={f.id}
              role="tab"
              aria-selected={active}
              onClick={() => setFilter(f.id)}
              className={cn(
                "relative flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors",
                active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span layoutId="webinar-filter" className="absolute inset-0 rounded-md bg-accent" transition={{ type: "spring", bounce: 0.15, duration: 0.35 }} />
              )}
              <span className="relative">{f.label}</span>
              <span className="relative rounded-full bg-muted px-1.5 text-[11px] text-muted-foreground tabular-nums">
                {counts[f.id]}
              </span>
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
                className="group relative flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-accent/40"
              >
                <div className="hidden size-11 shrink-0 flex-col items-center justify-center rounded-lg border bg-background sm:flex">
                  <span className="text-[10px] font-medium text-muted-foreground uppercase">{item.monthLabel}</span>
                  <span className="text-sm leading-none font-semibold">{item.dayLabel}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link
                      href={`/dashboard/webinars/${item.id}`}
                      className="truncate font-medium after:absolute after:inset-0 focus-visible:outline-none"
                    >
                      {item.title}
                    </Link>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
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
