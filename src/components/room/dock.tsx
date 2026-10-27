"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  BarChart3,
  ChevronUp,
  Circle,
  Hand,
  Keyboard,
  LogOut,
  MessageCircleQuestion,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  MoreHorizontal,
  PhoneOff,
  Radio,
  Settings2,
  SmilePlus,
  Square,
  Users,
  Video,
  VideoOff,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { REACTIONS, type Reaction } from "@/lib/realtime/protocol";
import type { WebinarStatus } from "@/lib/webinars/types";
import type { LocalMedia } from "./use-local-media";
import type { RecorderState } from "./use-recorder";

export type Panel = "chat" | "qna" | "polls" | "people";

const PANELS = [
  { id: "chat", label: "Chat", shortcut: "C", icon: MessageSquare },
  { id: "qna", label: "Q&A", shortcut: "Q", icon: MessageCircleQuestion },
  { id: "polls", label: "Polls", shortcut: "P", icon: BarChart3 },
  { id: "people", label: "People", shortcut: "U", icon: Users },
] as const satisfies readonly { id: Panel; label: string; shortcut: string; icon: unknown }[];

function CountBadge({
  badge,
  dotClassName,
  numberClassName = "-top-0.5 -right-0.5",
}: {
  badge: number | "dot" | undefined;
  dotClassName?: string;
  numberClassName?: string;
}) {
  if (badge === "dot") return <span className={cn("absolute size-2 rounded-full bg-highlight ring-2 ring-stage", dotClassName)} />;
  if (!badge) return null;
  return (
    <span
      className={cn(
        "absolute min-w-4.5 rounded-full bg-highlight px-1 text-[10px] leading-4.5 font-semibold text-black tabular-nums",
        numberClassName,
      )}
    >
      {badge > 99 ? "99+" : badge}
    </span>
  );
}

const btn =
  "relative flex size-11 items-center justify-center rounded-full text-white/90 transition-all outline-none hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary active:scale-95 disabled:opacity-40 [&_svg]:size-5";

function DockButton({
  label,
  shortcut,
  onClick,
  active,
  danger,
  className,
  children,
  badge,
}: {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  active?: boolean;
  danger?: boolean;
  className?: string;
  children: React.ReactNode;
  badge?: number | "dot";
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          aria-label={label}
          aria-pressed={active}
          className={cn(btn, active && "bg-white/15", danger && "bg-destructive text-white hover:bg-destructive/90", className)}
        >
          {children}
          <CountBadge badge={badge} dotClassName="top-2 right-2" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top">
        {label}
        {shortcut && <kbd className="ml-2 rounded bg-white/15 px-1 font-mono text-[10px]">{shortcut}</kbd>}
      </TooltipContent>
    </Tooltip>
  );
}

function Divider() {
  return <span aria-hidden className="mx-0.5 hidden h-6 w-px bg-white/15 sm:block" />;
}

type Props = {
  isHost: boolean;
  status: WebinarStatus;
  media: LocalMedia;
  micLevel: number;
  handRaised: boolean;
  handRaiseEnabled: boolean;
  reactionsEnabled: boolean;
  panel: Panel | null;
  badges: Record<Panel, number | "dot" | undefined>;
  recorder: { state: RecorderState; supported: boolean };
  volume: number;
  onVolume: (v: number) => void;
  onPanel: (p: Panel) => void;
  onReact: (emoji: Reaction) => void;
  onToggleHand: () => void;
  onToggleRecord: () => void;
  onSettings: () => void;
  onShortcuts: () => void;
  onGoLive: () => void;
  onEnd: () => void;
  onLeave: () => void;
  goingLive: boolean;
};

export function Dock(p: Props) {
  const [reactOpen, setReactOpen] = useState(false);
  const { media } = p;
  const live = p.status === "live";

  return (
    <div className="glass flex max-w-[calc(100vw-1.5rem)] items-center gap-0.5 overflow-x-auto rounded-full p-1.5 shadow-2xl sm:gap-1 sm:overflow-visible">
      {p.isHost && (
        <>
          <div className="flex items-center">
            <DockButton
              label={media.micOn ? "Mute" : "Unmute"}
              shortcut="M"
              onClick={() => void media.toggleMic()}
              danger={!media.micOn}
            >
              {media.micOn ? <Mic /> : <MicOff />}
              {media.micOn && (
                <span
                  aria-hidden
                  className="absolute inset-1 rounded-full ring-2 ring-primary transition-opacity duration-100"
                  style={{ opacity: Math.min(1, p.micLevel * 1.6) }}
                />
              )}
            </DockButton>
            <DeviceMenu kind="mic" media={media} />
          </div>
          <div className="flex items-center">
            <DockButton
              label={media.camera ? "Stop video" : "Start video"}
              shortcut="V"
              onClick={() => void media.toggleCamera()}
              danger={!media.camera}
            >
              {media.camera ? <Video /> : <VideoOff />}
            </DockButton>
            <DeviceMenu kind="camera" media={media} />
          </div>
          {media.canShareScreen && (
            <DockButton
              label={media.screen ? "Stop presenting" : "Present screen"}
              shortcut="S"
              onClick={() => void media.toggleScreen()}
              className={cn("hidden sm:flex", media.screen && "bg-primary text-primary-foreground hover:bg-primary/90")}
            >
              <MonitorUp />
            </DockButton>
          )}
          <Divider />
        </>
      )}

      {!p.isHost && (
        <Popover>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button type="button" aria-label="Volume" className={btn}>
                  <Volume2 />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">Volume</TooltipContent>
          </Tooltip>
          <PopoverContent side="top" className="w-56">
            <p className="mb-3 text-xs text-muted-foreground">Volume · {p.volume}%</p>
            <Slider value={[p.volume]} min={0} max={100} step={5} onValueChange={([v]) => p.onVolume(v ?? 100)} aria-label="Volume" />
          </PopoverContent>
        </Popover>
      )}

      {(p.reactionsEnabled || p.isHost) && (
        <Popover open={reactOpen} onOpenChange={setReactOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button type="button" aria-label="React" className={cn(btn, reactOpen && "bg-white/15")}>
                  <SmilePlus />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="top">
              React <kbd className="ml-2 rounded bg-white/15 px-1 font-mono text-[10px]">1–8</kbd>
            </TooltipContent>
          </Tooltip>
          <PopoverContent side="top" className="w-auto rounded-full p-1.5">
            <div className="flex gap-0.5">
              {REACTIONS.map((emoji, i) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => p.onReact(emoji)}
                  aria-label={`React ${emoji} (${i + 1})`}
                  className="flex size-10 items-center justify-center rounded-full text-xl transition-transform hover:-translate-y-0.5 hover:scale-125 hover:bg-accent active:scale-90"
                >
                  {emoji}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}

      {!p.isHost && p.handRaiseEnabled && (
        <DockButton
          label={p.handRaised ? "Lower hand" : "Raise hand"}
          shortcut="H"
          onClick={p.onToggleHand}
          className={cn(p.handRaised && "bg-highlight text-black hover:bg-highlight/90")}
        >
          <Hand />
        </DockButton>
      )}

      <Divider />

      {/* On phones these live in MobilePanelNav instead. */}
      {PANELS.map(({ id, label, shortcut, icon: Icon }) => (
        <DockButton
          key={id}
          label={label}
          shortcut={shortcut}
          onClick={() => p.onPanel(id)}
          active={p.panel === id}
          badge={p.badges[id]}
          className="hidden sm:flex"
        >
          <Icon />
        </DockButton>
      ))}

      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <button type="button" aria-label="More" className={btn}>
                <MoreHorizontal />
              </button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">More</TooltipContent>
        </Tooltip>
        <DropdownMenuContent side="top" align="end" className="w-56">
          {p.isHost && p.recorder.supported && (
            <DropdownMenuItem onSelect={p.onToggleRecord} disabled={p.recorder.state === "starting" || p.recorder.state === "saving"}>
              {p.recorder.state === "recording" ? <Square className="text-live" /> : <Circle className="text-live" />}
              {p.recorder.state === "recording" ? "Stop recording" : p.recorder.state === "saving" ? "Saving…" : "Record to this computer"}
              <span className="ml-auto font-mono text-[10px] text-muted-foreground">R</span>
            </DropdownMenuItem>
          )}
          {p.isHost && (
            <DropdownMenuItem onSelect={p.onSettings}>
              <Settings2 /> Room settings
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onSelect={p.onShortcuts}>
            <Keyboard /> Keyboard shortcuts
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">?</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Divider />

      {p.isHost && !live && p.status !== "ended" && (
        <Button onClick={p.onGoLive} disabled={p.goingLive} className="h-11 shrink-0 rounded-full bg-live px-5 text-white hover:bg-live/90">
          <Radio /> Go live
        </Button>
      )}
      {p.isHost && live && (
        <Button onClick={p.onEnd} className="h-11 shrink-0 rounded-full bg-destructive px-5 text-white hover:bg-destructive/90">
          <PhoneOff /> End
        </Button>
      )}
      {!p.isHost && (
        <Button onClick={p.onLeave} variant="ghost" className="h-11 shrink-0 rounded-full px-4 text-white hover:bg-white/10 hover:text-white">
          <LogOut /> Leave
        </Button>
      )}
    </div>
  );
}

/** Phones: the room's panels as a labeled bottom navigation bar. */
export function MobilePanelNav({
  panel,
  badges,
  onPanel,
}: {
  panel: Panel | null;
  badges: Props["badges"];
  onPanel: (p: Panel) => void;
}) {
  return (
    <nav
      aria-label="Room panels"
      className="relative z-50 grid shrink-0 grid-cols-4 border-t border-white/10 bg-stage pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      {PANELS.map(({ id, label, icon: Icon }) => {
        const active = panel === id;
        return (
          <button
            key={id}
            type="button"
            onClick={() => onPanel(id)}
            aria-pressed={active}
            className={cn(
              "relative flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-white/55 transition-colors outline-none focus-visible:bg-white/5 active:bg-white/5",
              active && "text-white",
            )}
          >
            {active && (
              <motion.span
                layoutId="mobile-panel-indicator"
                transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary"
              />
            )}
            <span className="relative">
              <Icon className="size-5" />
              <CountBadge badge={badges[id]} dotClassName="-top-0.5 -right-0.5" numberClassName="-top-2 -right-3" />
            </span>
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function DeviceMenu({ kind, media }: { kind: "mic" | "camera"; media: LocalMedia }) {
  const list = kind === "mic" ? media.devices.mics : media.devices.cameras;
  const value = kind === "mic" ? media.micId : media.cameraId;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={kind === "mic" ? "Audio settings" : "Video settings"}
          className="-ml-1 hidden h-11 w-5 items-center justify-center rounded-full text-white/60 hover:text-white sm:flex"
        >
          <ChevronUp className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-72">
        <DropdownMenuLabel>{kind === "mic" ? "Microphone" : "Camera"}</DropdownMenuLabel>
        {list.length === 0 ? (
          <DropdownMenuItem disabled>No devices found</DropdownMenuItem>
        ) : (
          <DropdownMenuRadioGroup value={value ?? ""} onValueChange={(id) => void media.selectDevice(kind, id)}>
            {list.map((d, i) => (
              <DropdownMenuRadioItem key={d.deviceId} value={d.deviceId}>
                <span className="truncate">{d.label || `${kind === "mic" ? "Microphone" : "Camera"} ${i + 1}`}</span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        )}
        {kind === "mic" && media.devices.speakers.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Speaker</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={media.speakerId ?? ""} onValueChange={(id) => void media.selectDevice("speaker", id)}>
              {media.devices.speakers.map((d, i) => (
                <DropdownMenuRadioItem key={d.deviceId} value={d.deviceId}>
                  <span className="truncate">{d.label || `Speaker ${i + 1}`}</span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
