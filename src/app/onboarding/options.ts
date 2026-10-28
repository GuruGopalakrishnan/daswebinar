/** Onboarding choices (from the approved prototype). Values are stored on the account's metadata. */
export const ONBOARDING_WORK = [
  { value: "coach", label: "Coach" },
  { value: "consultant", label: "Consultant" },
  { value: "educator", label: "Educator" },
  { value: "creator", label: "Creator" },
  { value: "business_owner", label: "Business owner" },
  { value: "other", label: "Other" },
] as const;

// Prototype goals that depend on unbuilt features (paid workshops, automated webinars) are left out.
export const ONBOARDING_GOALS = [
  { value: "live_webinars", label: "Host live webinars" },
  { value: "teach_online", label: "Teach online" },
  { value: "generate_leads", label: "Generate leads" },
] as const;
