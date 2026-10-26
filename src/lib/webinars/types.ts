// Row shapes mirror supabase/migrations/*.sql.
// Replace with `supabase gen types typescript` output once the CLI is linked.

import type { CustomField } from "./schema";

export type WebinarStatus = "draft" | "scheduled" | "live" | "ended" | "cancelled";
export type WebinarVisibility = "public" | "unlisted";
export type RegistrationStatus = "pending" | "approved" | "rejected" | "cancelled";

export type WebinarRow = {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  status: WebinarStatus;
  visibility: WebinarVisibility;
  requires_approval: boolean;
  capacity: number | null;
  custom_fields: CustomField[];
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PublicWebinarRow = {
  id: string;
  title: string;
  description: string | null;
  starts_at: string;
  duration_minutes: number;
  timezone: string;
  status: WebinarStatus;
  requires_approval: boolean;
  host_name: string | null;
  is_full: boolean;
  custom_fields: CustomField[];
  registered_count: number;
};

export type RecordingRow = {
  id: string;
  webinar_id: string;
  title: string;
  video_url: string;
  duration_seconds: number | null;
  created_at: string;
};

export type RegistrationRow = {
  id: string;
  webinar_id: string;
  user_id: string | null;
  email: string;
  full_name: string;
  status: RegistrationStatus;
  answers: Record<string, string | boolean>;
  created_at: string;
  updated_at: string;
};
