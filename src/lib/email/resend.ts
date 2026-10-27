import "server-only";

/**
 * Minimal Resend client (https://resend.com/docs/api-reference). Uses fetch so
 * there's no SDK dependency. Keys are read at request time.
 */

const API = "https://api.resend.com";

export function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return null;
  return { apiKey, from, replyTo: process.env.EMAIL_REPLY_TO || undefined };
}

export type ResendConfig = NonNullable<ReturnType<typeof resendConfig>>;

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Single sends only; Resend's batch endpoint doesn't take attachments. */
  attachments?: { filename: string; content: string; contentType: string }[];
};

/** Resend allows 100 emails per batch call. */
export const BATCH_LIMIT = 100;

async function call(config: ResendConfig, path: string, body: unknown, idempotencyKey: string) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      // Resend drops a repeat of the same key for 24 h, so a retried request can't double-send.
      "Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(`Resend ${path} failed: ${json?.message ?? `HTTP ${res.status}`}`);
  }
}

function payload(config: ResendConfig, email: OutgoingEmail) {
  return {
    from: config.from,
    to: [email.to],
    subject: email.subject,
    html: email.html,
    text: email.text,
    ...(config.replyTo ? { reply_to: config.replyTo } : {}),
  };
}

export function sendEmail(config: ResendConfig, email: OutgoingEmail, idempotencyKey: string) {
  return call(
    config,
    "/emails",
    {
      ...payload(config, email),
      ...(email.attachments
        ? {
            attachments: email.attachments.map((a) => ({
              filename: a.filename,
              content: Buffer.from(a.content).toString("base64"),
              content_type: a.contentType,
            })),
          }
        : {}),
    },
    idempotencyKey,
  );
}

/** Up to BATCH_LIMIT emails in one call. */
export function sendBatch(config: ResendConfig, emails: OutgoingEmail[], idempotencyKey: string) {
  return call(config, "/emails/batch", emails.map((e) => payload(config, e)), idempotencyKey);
}
