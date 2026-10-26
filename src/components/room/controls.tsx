"use client";

import { useState } from "react";
import {
  Hand,
  LogOut,
  Mic,
  MicOff,
  MonitorUp,
  PhoneOff,
  Radio,
  Settings2,
  SmilePlus,
  Video,
  VideoOff,
} from "lucide-react";
import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { REACTIONS, type Reaction } from "../../../server/socket/protocol";

function ControlButton({
  label,
  active = true,
  danger,
  onClick,
  disabled,
  children,
  className,
}: {
  label: string;
  active?: boolean;
  danger?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          aria-pressed={danger ? undefined : active}
          className={cn(
            "relative flex size-11 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 [&_svg]:size-5",
            active ? "bg-secondary text-secondary-foreground hover:bg-accent" : "bg-destructive/90 text-white hover:bg-destructive",
            className,
          )}
        >
          {children}
        </button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

type Props = {
  isHost: boolean;
  status: "draft" | "scheduled" | "live" | "ended" | "cancelled";
  micOn: boolean;
  camOn: boolean;
  sharing: boolean;
  canShareScreen: boolean;
  micLevel: number;
  handRaised: boolean;
  handRaiseEnabled: boolean;
  reactionsEnabled: boolean;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreen: () => void;
  onReact: (emoji: Reaction) => void;
  onToggleHand: () => void;
  onOpenSettings: () => void;
  onGoLive: () => void;
  onEnd: () => void;
  onLeave: () => void;
  goingLive: boolean;
};

export function Controls(p: Props) {
  const [reactOpen, setReactOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {p.isHost && (
        <>
          <ControlButton label={p.micOn ? "Mute microphone" : "Unmute microphone"} active={p.micOn} onClick={p.onToggleMic}>
            {p.micOn ? <Mic /> : <MicOff />}
            {p.micOn && (
              <motion.span
                aria-hidden
                className="absolute inset-0 rounded-full ring-2 ring-success"
                animate={{ opacity: Math.min(1, p.micLevel * 1.5) }}
              />
            )}
          </ControlButton>
          <ControlButton label={p.camOn ? "Turn camera off" : "Turn camera on"} active={p.camOn} onClick={p.onToggleCam}>
            {p.camOn ? <Video /> : <VideoOff />}
          </ControlButton>
          {p.canShareScreen && (
            <ControlButton
              label={p.sharing ? "Stop presenting" : "Present screen"}
              active
              onClick={p.onToggleScreen}
              className={cn("hidden sm:flex", p.sharing && "bg-primary text-primary-foreground hover:bg-primary/90")}
            >
              <MonitorUp />
            </ControlButton>
          )}
        </>
      )}

      {p.reactionsEnabled || p.isHost ? (
        <Popover open={reactOpen} onOpenChange={setReactOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-label="Send a reaction"
                  className="flex size-11 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none [&_svg]:size-5"
                >
                  <SmilePlus />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent>React</TooltipContent>
          </Tooltip>
          <PopoverContent side="top" className="w-auto rounded-full p-1.5">
            <div className="flex gap-0.5">
              {REACTIONS.map((emoji) => (
                <motion.button
                  key={emoji}
                  whileHover={{ scale: 1.25, y: -2 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => p.onReact(emoji)}
                  aria-label={`React ${emoji}`}
                  className="flex size-9 items-center justify-center rounded-full text-xl hover:bg-accent"
                >
                  {emoji}
                </motion.button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      ) : null}

      {!p.isHost && p.handRaiseEnabled && (
        <ControlButton
          label={p.handRaised ? "Lower hand" : "Raise hand"}
          active
          onClick={p.onToggleHand}
          className={cn(p.handRaised && "bg-warning text-black hover:bg-warning/90")}
        >
          <Hand />
        </ControlButton>
      )}

      {p.isHost && (
        <ControlButton label="Room settings" active onClick={p.onOpenSettings}>
          <Settings2 />
        </ControlButton>
      )}

      <div className="mx-1 hidden h-8 w-px bg-border sm:block" />

      {p.isHost && (p.status === "scheduled" || p.status === "draft") && (
        <Button onClick={p.onGoLive} disabled={p.goingLive} className="h-11 rounded-full bg-live px-5 text-white hover:bg-live/90">
          <Radio /> Go live
        </Button>
      )}
      {p.isHost && p.status === "live" && (
        <Button onClick={p.onEnd} variant="destructive" className="h-11 rounded-full px-5">
          <PhoneOff /> End webinar
        </Button>
      )}
      {!p.isHost && (
        <Button onClick={p.onLeave} variant="outline" className="h-11 rounded-full px-5">
          <LogOut /> Leave
        </Button>
      )}
    </div>
  );
}
