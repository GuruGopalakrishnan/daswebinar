import type { CreateWebinarInput, UpdateWebinarInput } from "./schema";
import type { PublicWebinarRow, RecordingRow, RegistrationRow, WebinarRow } from "./types";

export const WEBINAR_COLUMNS =
  "id, host_id, title, description, starts_at, duration_minutes, timezone, status, visibility, requires_approval, capacity, custom_fields, started_at, ended_at, created_at, updated_at";

export const REGISTRATION_COLUMNS =
  "id, webinar_id, user_id, email, full_name, status, answers, join_token, created_at, updated_at";

export const RECORDING_COLUMNS = "id, webinar_id, title, video_url, duration_seconds, created_at";

export function toWebinarDto(row: WebinarRow) {
  return {
    id: row.id,
    hostId: row.host_id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    status: row.status,
    visibility: row.visibility,
    requiresApproval: row.requires_approval,
    capacity: row.capacity,
    customFields: row.custom_fields,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type WebinarDto = ReturnType<typeof toWebinarDto>;

export function toPublicWebinarDto(row: PublicWebinarRow) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    timezone: row.timezone,
    status: row.status,
    requiresApproval: row.requires_approval,
    hostName: row.host_name,
    isFull: row.is_full,
    customFields: row.custom_fields,
    registeredCount: row.registered_count,
  };
}

export type PublicWebinarDto = ReturnType<typeof toPublicWebinarDto>;

export function toRegistrationDto(row: RegistrationRow) {
  return {
    id: row.id,
    webinarId: row.webinar_id,
    userId: row.user_id,
    email: row.email,
    fullName: row.full_name,
    status: row.status,
    answers: row.answers,
    joinToken: row.join_token,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export type RegistrationDto = ReturnType<typeof toRegistrationDto>;

export function toRecordingDto(row: RecordingRow) {
  return {
    id: row.id,
    webinarId: row.webinar_id,
    title: row.title,
    videoUrl: row.video_url,
    durationSeconds: row.duration_seconds,
    createdAt: row.created_at,
  };
}

export type RecordingDto = ReturnType<typeof toRecordingDto>;

/** camelCase API input → snake_case columns, keeping only provided keys. */
export function toWebinarColumns(input: Partial<CreateWebinarInput> | UpdateWebinarInput) {
  const map = {
    title: "title",
    description: "description",
    startsAt: "starts_at",
    durationMinutes: "duration_minutes",
    timezone: "timezone",
    status: "status",
    visibility: "visibility",
    requiresApproval: "requires_approval",
    capacity: "capacity",
    customFields: "custom_fields",
  } as const;

  const columns: Record<string, unknown> = {};
  for (const [key, column] of Object.entries(map)) {
    const value = (input as Record<string, unknown>)[key];
    if (value !== undefined) columns[column] = value;
  }
  return columns;
}
