export type RtcRoleName = "host" | "audience";

/** POST /api/webinars/:id/rtc-token */
export type RtcCredentials = {
  appId: string;
  channel: string;
  uid: number;
  /** null when the Agora project has no App Certificate (testing mode). */
  token: string | null;
  role: RtcRoleName;
  /** Camera + microphone. */
  hostUid: number;
  /** Screen share (a second connection, so the camera stays on while presenting). */
  screenUid: number;
  /** Host only: credentials for the screen-share connection. */
  screen: { uid: number; token: string | null } | null;
  expiresAt: string;
};
