"use client";

import { PreJoin } from "@/components/room/prejoin";
import { useLocalMedia } from "@/components/room/use-local-media";

/** Dev preview: the real pre-join screen and media hook, without a room or Agora. */
export function PreJoinPreview({ isHost }: { isHost: boolean }) {
  const media = useLocalMedia();
  return <PreJoin isHost={isHost} title="Growth Masterclass for Coaches" name="Ananya Rao" media={media} onJoin={() => {}} />;
}
