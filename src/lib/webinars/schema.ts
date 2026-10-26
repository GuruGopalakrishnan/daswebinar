import { z } from "zod";

function isTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

const title = z.string().trim().min(1).max(200);
const description = z.string().trim().max(5000).nullable();
const startsAt = z.iso.datetime({ offset: true });
const durationMinutes = z.int().min(5).max(720);
const timezone = z.string().max(64).refine(isTimeZone, "Unknown IANA time zone.");
const visibility = z.enum(["public", "unlisted"]);
const capacity = z.int().min(1).max(100_000).nullable();

export const CUSTOM_FIELD_TYPES = ["text", "textarea", "select", "checkbox"] as const;

export const customFieldSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9_-]{1,40}$/i),
    label: z.string().trim().min(1).max(120),
    type: z.enum(CUSTOM_FIELD_TYPES),
    required: z.boolean().default(false),
    options: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
  })
  .strict()
  .refine((f) => f.type !== "select" || f.options.length >= 2, {
    message: "Dropdown fields need at least two options.",
    path: ["options"],
  });

const customFields = z
  .array(customFieldSchema)
  .max(10)
  .refine((fields) => new Set(fields.map((f) => f.id)).size === fields.length, "Field ids must be unique.");

export type CustomField = z.output<typeof customFieldSchema>;

export const createWebinarSchema = z
  .object({
    title,
    description: description.optional(),
    startsAt,
    durationMinutes: durationMinutes.default(60),
    timezone: timezone.default("UTC"),
    status: z.enum(["draft", "scheduled"]).default("draft"),
    visibility: visibility.default("unlisted"),
    requiresApproval: z.boolean().default(false),
    capacity: capacity.optional(),
    customFields: customFields.default([]),
  })
  .strict()
  .refine((w) => w.status === "draft" || Date.parse(w.startsAt) > Date.now(), {
    message: "A scheduled webinar must start in the future.",
    path: ["startsAt"],
  });

// live/ended are server-managed (phase 4); hosts can only draft, schedule or cancel.
export const updateWebinarSchema = z
  .object({
    title,
    description,
    startsAt,
    durationMinutes,
    timezone,
    status: z.enum(["draft", "scheduled", "cancelled"]),
    visibility,
    requiresApproval: z.boolean(),
    capacity,
    customFields,
  })
  .partial()
  .strict()
  .refine((patch) => Object.keys(patch).length > 0, "Provide at least one field to update.");

export const listWebinarsQuerySchema = z.object({
  status: z.enum(["draft", "scheduled", "live", "ended", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const registerSchema = z
  .object({
    email: z.email().max(254),
    fullName: z.string().trim().min(1).max(100),
    answers: z
      .record(z.string().max(40), z.union([z.string().max(1000), z.boolean()]))
      .refine((a) => Object.keys(a).length <= 10, "Too many answers.")
      .default({}),
  })
  .strict();

export const createRecordingSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    videoUrl: z.url({ protocol: /^https$/ }).max(2048),
    durationSeconds: z.int().min(0).max(86_400).nullable().optional(),
  })
  .strict();

export const listRegistrationsQuerySchema = z.object({
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const updateRegistrationSchema = z
  .object({ status: z.enum(["approved", "rejected", "cancelled"]) })
  .strict();

export type CreateWebinarInput = z.output<typeof createWebinarSchema>;
export type UpdateWebinarInput = z.output<typeof updateWebinarSchema>;
