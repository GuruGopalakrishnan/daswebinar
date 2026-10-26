"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddRecordingDialog({ webinarId, defaultTitle }: { webinarId: string; defaultTitle: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const minutes = Number(form.get("duration") || 0);
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/webinars/${webinarId}/recordings`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: String(form.get("title") ?? "").trim(),
          videoUrl: String(form.get("url") ?? "").trim(),
          durationSeconds: minutes > 0 ? Math.round(minutes * 60) : null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        const fieldErrors = json?.error?.details?.fieldErrors as Record<string, string[]> | undefined;
        setError(fieldErrors?.videoUrl ? "Enter a valid https:// video URL." : (json?.error?.message ?? "Couldn't add the recording."));
        return;
      }
      toast.success("Recording added");
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Add recording
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form onSubmit={onSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Add a recording</DialogTitle>
            <DialogDescription>
              Paste a direct link to an MP4/WebM file. Approved registrants will be able to watch it.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="rec-title">Title</Label>
            <Input id="rec-title" name="title" defaultValue={`${defaultTitle} — replay`} required maxLength={200} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rec-url">Video URL</Label>
            <Input id="rec-url" name="url" type="url" placeholder="https://…/replay.mp4" required pattern="https://.*" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="rec-duration">Length (minutes, optional)</Label>
            <Input id="rec-duration" name="duration" type="number" min={0} step="any" className="max-w-32" />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="animate-spin" />} Add recording
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
