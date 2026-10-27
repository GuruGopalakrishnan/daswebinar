"use client";

import { AnimatePresence, motion } from "motion/react";
import { Hand, MoreHorizontal, UserX } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { UserAvatar } from "@/components/user-avatar";
import type { Author, HandRaise } from "@/lib/realtime/protocol";
import type { RoomActions } from "./use-room";

export function PeoplePanel({
  members,
  handRaises,
  me,
  actions,
}: {
  members: Author[];
  handRaises: HandRaise[];
  me: Author | null;
  actions: RoomActions;
}) {
  const isHost = me?.role === "host";

  async function remove(member: Author) {
    if (!window.confirm(`Remove ${member.name}? They won't be able to rejoin this webinar.`)) return;
    const res = await actions.removeAttendee(member.userId);
    if (res.ok) toast.success(`${member.name} was removed`);
    else toast.error(res.error.message);
  }

  async function lower(userId: string) {
    const res = await actions.lowerHand(userId);
    if (!res.ok) toast.error(res.error.message);
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto p-3 scrollbar-thin">
      <AnimatePresence initial={false}>
        {handRaises.length > 0 && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-4 overflow-hidden"
            aria-labelledby="hands-heading"
          >
            <h3 id="hands-heading" className="mb-2 flex items-center gap-1.5 px-1 text-xs font-medium text-warning">
              <Hand className="size-3.5" /> Raised hands · {handRaises.length}
            </h3>
            <ul className="grid gap-1 rounded-xl border border-warning/30 bg-warning/5 p-1.5">
              {handRaises.map((h, i) => (
                <motion.li layout key={h.userId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                  <span className="w-4 text-center text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <UserAvatar name={h.name} id={h.userId} className="size-7 text-[10px]" />
                  <span className="min-w-0 flex-1 truncate text-sm">{h.userId === me?.userId ? "You" : h.name}</span>
                  {(isHost || h.userId === me?.userId) && (
                    <Button variant="ghost" size="xs" onClick={() => void lower(h.userId)}>
                      Lower
                    </Button>
                  )}
                </motion.li>
              ))}
            </ul>
          </motion.section>
        )}
      </AnimatePresence>

      <h3 className="mb-2 px-1 text-xs font-medium text-muted-foreground">In the room · {members.length}</h3>
      <ul className="grid gap-0.5">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/40">
            <span className="relative">
              <UserAvatar name={m.name} id={m.userId} className="size-7 text-[10px]" />
              <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-card bg-success" aria-hidden />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm">
              {m.name}
              {m.userId === me?.userId && <span className="text-muted-foreground"> (you)</span>}
            </span>
            {m.role === "host" && (
              <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary uppercase">Host</span>
            )}
            {handRaises.some((h) => h.userId === m.userId) && <Hand className="size-3.5 text-warning" aria-label="Hand raised" />}
            {isHost && m.role !== "host" && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-xs" aria-label={`Actions for ${m.name}`}>
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem variant="destructive" onSelect={() => void remove(m)}>
                    <UserX /> Remove from webinar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
