import "server-only";
import { randomInt } from "node:crypto";
import { RtcRole, RtcTokenBuilder } from "agora-token";
import type { RtcCredentials, RtcRoleName } from "./types";

/**
 * The host always publishes camera + mic as HOST_UID and their screen share as
 * HOST_SCREEN_UID (a second connection, so attendees see both at once).
 * Panelists publish as the fixed stage uid the database gave them (100–105).
 * Attendees get random uids and only render the host's two uids plus the
 * current panelists' uids, so an attendee who publishes anyway is never shown.
 * With an App Certificate the token binds the uid, so nobody else can join as
 * the host or a panelist.
 */
export const HOST_UID = 1;
export const HOST_SCREEN_UID = 2;
const TOKEN_TTL_SECONDS = 60 * 60;

/** Read at request time (not NEXT_PUBLIC_, which is inlined at build). */
export function agoraConfig() {
  const appId = process.env.AGORA_APP_ID;
  if (!appId) return null;
  return { appId, certificate: process.env.AGORA_APP_CERTIFICATE || null };
}

type Config = NonNullable<ReturnType<typeof agoraConfig>>;

function token(config: Config, channel: string, uid: number, publisher: boolean) {
  return config.certificate
    ? RtcTokenBuilder.buildTokenWithUid(
        config.appId,
        config.certificate,
        channel,
        uid,
        // SUBSCRIBER only restricts publishing once Agora enables co-host
        // authentication for the project; the fixed host uids are the real guard.
        publisher ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER,
        TOKEN_TTL_SECONDS,
        TOKEN_TTL_SECONDS,
      )
    : null;
}

/**
 * Channel = webinar id. Without a certificate (Agora "testing mode") tokens are null.
 * Panelists pass the stage uid the database assigned them.
 */
export function issueRtcCredentials(config: Config, channel: string, role: RtcRoleName, stageUid?: number): RtcCredentials {
  if (role === "panelist" && !stageUid) throw new Error("A panelist needs a stage uid.");
  const uid = role === "host" ? HOST_UID : role === "panelist" ? stageUid! : randomInt(1000, 2 ** 32 - 1);
  return {
    appId: config.appId,
    channel,
    uid,
    token: token(config, channel, uid, role !== "audience"),
    role,
    hostUid: HOST_UID,
    screenUid: HOST_SCREEN_UID,
    screen: role === "host" ? { uid: HOST_SCREEN_UID, token: token(config, channel, HOST_SCREEN_UID, true) } : null,
    expiresAt: new Date(Date.now() + TOKEN_TTL_SECONDS * 1000).toISOString(),
  };
}
