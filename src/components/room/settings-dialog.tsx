"use client";

import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Settings } from "@/lib/realtime/protocol";
import type { RoomActions } from "./use-room";

const TOGGLES: { key: "chatEnabled" | "qnaEnabled" | "reactionsEnabled" | "handRaiseEnabled"; label: string; body: string }[] = [
  { key: "chatEnabled", label: "Chat", body: "Attendees can send messages." },
  { key: "qnaEnabled", label: "Q&A", body: "Attendees can ask and upvote questions." },
  { key: "reactionsEnabled", label: "Reactions", body: "Emoji reactions float over the stage." },
  { key: "handRaiseEnabled", label: "Raise hand", body: "Attendees can raise their hand." },
];

const SLOW_MODE = [0, 5, 10, 30, 60, 120];

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: Settings | null;
  actions: RoomActions;
}) {
  async function update(patch: Partial<Settings>) {
    const res = await actions.updateSettings(patch);
    if (!res.ok) toast.error(res.error.message);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Room settings</DialogTitle>
          <DialogDescription>Changes apply instantly for everyone in the room.</DialogDescription>
        </DialogHeader>
        {settings && (
          <div className="grid gap-1">
            {TOGGLES.map((t) => (
              <div key={t.key} className="flex items-center justify-between gap-4 rounded-lg px-1 py-2.5">
                <div>
                  <Label htmlFor={`setting-${t.key}`}>{t.label}</Label>
                  <p className="text-xs text-muted-foreground">{t.body}</p>
                </div>
                <Switch
                  id={`setting-${t.key}`}
                  checked={settings[t.key]}
                  onCheckedChange={(v) => void update({ [t.key]: v })}
                />
              </div>
            ))}
            <div className="flex items-center justify-between gap-4 rounded-lg px-1 py-2.5">
              <div>
                <Label htmlFor="setting-slow">Slow mode</Label>
                <p className="text-xs text-muted-foreground">Minimum time between attendee messages.</p>
              </div>
              <Select value={String(settings.slowModeSeconds)} onValueChange={(v) => void update({ slowModeSeconds: Number(v) })}>
                <SelectTrigger id="setting-slow" className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOW_MODE.map((s) => (
                    <SelectItem key={s} value={String(s)}>
                      {s === 0 ? "Off" : s < 60 ? `${s}s` : `${s / 60} min`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
