// End-to-end test of the webinar API against a running app and the real
// Supabase project.
//
//   1. Put two confirmed test accounts in .env.test.local (gitignored):
//        E2E_HOST_EMAIL=...      E2E_HOST_PASSWORD=...
//        E2E_OTHER_EMAIL=...     E2E_OTHER_PASSWORD=...
//   2. npm run build && npx next start -p 3123
//   3. node scripts/e2e-api.mjs            (E2E_BASE_URL overrides the URL)
//
// Creates webinars under the host account and deletes them at the end.
// Guest registrations use @example.com addresses; no email is sent.

import { readFileSync, existsSync } from "node:fs";
import { createServerClient } from "@supabase/ssr";

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.local");
loadEnv(".env.test.local");

const BASE = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3123";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

for (const name of ["E2E_HOST_EMAIL", "E2E_HOST_PASSWORD", "E2E_OTHER_EMAIL", "E2E_OTHER_PASSWORD"]) {
  if (!process.env[name]) {
    console.error(`Missing ${name}. See the header of scripts/e2e-api.mjs.`);
    process.exit(2);
  }
}

// --- harness ----------------------------------------------------------------

const results = [];
function check(name, condition, detail) {
  results.push({ name, ok: Boolean(condition) });
  console.log(`${condition ? "PASS" : "FAIL"}  ${name}${condition || detail === undefined ? "" : `  -> ${JSON.stringify(detail)}`}`);
}

/** A Supabase client with an in-memory cookie jar, so we get exactly the
 *  cookies @supabase/ssr would set in a browser. */
async function signIn(email, password) {
  const jar = new Map();
  const client = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (cookies) => cookies.forEach(({ name, value }) => (value ? jar.set(name, value) : jar.delete(name))),
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`Sign-in failed for test account: ${error.message}`);
  const cookie = [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  return { client, cookie, userId: data.user.id, email: data.user.email };
}

function anonClient() {
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: { getAll: () => [], setAll: () => {} },
  });
}

async function api(method, path, { as, body, contentType = "application/json" } = {}) {
  const headers = {};
  if (as) headers.cookie = as.cookie;
  if (body !== undefined) headers["content-type"] = contentType;
  const res = await fetch(BASE + path, {
    method,
    headers,
    body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    redirect: "manual",
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* non-JSON */ }
  return { status: res.status, json, headers: res.headers };
}

// --- test -------------------------------------------------------------------

const run = Date.now().toString(36);
const guest = (n) => `e2e-${run}-guest${n}@example.com`;
const inOneDay = new Date(Date.now() + 86_400_000).toISOString();
const created = [];

const host = await signIn(process.env.E2E_HOST_EMAIL, process.env.E2E_HOST_PASSWORD);
const other = await signIn(process.env.E2E_OTHER_EMAIL, process.env.E2E_OTHER_PASSWORD);
check("test accounts are distinct users", host.userId !== other.userId);

try {
  // Create
  let r = await api("POST", "/api/webinars", {
    as: host,
    body: {
      title: `E2E ${run}`, description: "end-to-end test", startsAt: inOneDay,
      durationMinutes: 45, timezone: "Asia/Kolkata", status: "scheduled", capacity: 2,
    },
  });
  check("POST /api/webinars creates (201)", r.status === 201, r);
  const w = r.json?.data;
  if (w) created.push(w.id);
  check("create sets Location header", r.headers.get("location") === `/api/webinars/${w?.id}`);
  check("create returns host as owner", w?.hostId === host.userId);
  check("defaults applied (unlisted, no approval)", w?.visibility === "unlisted" && w?.requiresApproval === false);

  r = await api("POST", "/api/webinars", { as: host, body: { title: `E2E draft ${run}`, startsAt: inOneDay } });
  check("POST draft (201, status draft)", r.status === 201 && r.json?.data?.status === "draft", r);
  const draft = r.json?.data;
  if (draft) created.push(draft.id);

  // Validation
  r = await api("POST", "/api/webinars", {
    as: host, body: { title: "past", startsAt: "2020-01-01T00:00:00Z", status: "scheduled" },
  });
  check("scheduled in the past is rejected (400)", r.status === 400, r.json);
  r = await api("POST", "/api/webinars", { as: host, body: { title: "tz", startsAt: inOneDay, timezone: "Mars/Olympus" } });
  check("unknown time zone is rejected (400)", r.status === 400, r.json);
  r = await api("POST", "/api/webinars", { as: host, body: { title: "x", startsAt: inOneDay, hostId: other.userId } });
  check("unknown field hostId is rejected (400)", r.status === 400, r.json);
  r = await api("PATCH", `/api/webinars/${w.id}`, { as: host, body: { status: "live" } });
  check("PATCH status=live is rejected by API (400)", r.status === 400, r.json);
  r = await api("PATCH", `/api/webinars/${w.id}`, { as: host, body: {} });
  check("empty PATCH is rejected (400)", r.status === 400, r.json);

  // Read + list
  r = await api("GET", "/api/webinars?limit=50", { as: host });
  const ids = (r.json?.data ?? []).map((x) => x.id);
  check("list includes both webinars", r.status === 200 && ids.includes(w.id) && ids.includes(draft.id), r.status);
  r = await api("GET", "/api/webinars?status=draft&limit=50", { as: host });
  check("status filter works", (r.json?.data ?? []).every((x) => x.status === "draft") && r.json.data.some((x) => x.id === draft.id));
  r = await api("GET", "/api/webinars", { as: other });
  check("other user's list excludes host webinars", !(r.json?.data ?? []).some((x) => x.id === w.id), r.status);

  r = await api("GET", `/api/webinars/${w.id}`, { as: host });
  check("host GET sees host view", r.status === 200 && r.json?.view === "host");
  r = await api("GET", `/api/webinars/${w.id}`);
  const pub = r.json?.data ?? {};
  check("guest GET sees public view", r.status === 200 && r.json?.view === "public", r);
  check("public view hides host-only fields", !("hostId" in pub) && !("capacity" in pub) && !("visibility" in pub), Object.keys(pub));
  r = await api("GET", `/api/webinars/${draft.id}`);
  check("guest cannot see draft (404)", r.status === 404, r.status);
  r = await api("GET", `/api/webinars/${draft.id}`, { as: other });
  check("other user cannot see draft (404)", r.status === 404, r.status);

  // Cross-user writes
  r = await api("PATCH", `/api/webinars/${w.id}`, { as: other, body: { title: "hijacked" } });
  check("other user PATCH -> 404", r.status === 404, r.status);
  r = await api("DELETE", `/api/webinars/${w.id}`, { as: other });
  check("other user DELETE -> 404", r.status === 404, r.status);
  r = await api("GET", `/api/webinars/${w.id}/registrations`, { as: other });
  check("other user cannot list registrations (404)", r.status === 404, r.status);

  // Registration
  r = await api("POST", `/api/webinars/${w.id}/register`, { body: { email: guest(1), fullName: "Guest One" } });
  check("guest registers -> approved", r.status === 200 && r.json?.data?.status === "approved", r);
  const g1 = r.json?.data?.registrationId;
  r = await api("POST", `/api/webinars/${w.id}/register`, { body: { email: guest(1).toUpperCase(), fullName: "Guest One" } });
  check("re-register (case-insensitive) is idempotent", r.json?.data?.registrationId === g1, r.json);

  r = await api("POST", `/api/webinars/${w.id}/register`, { as: other, body: { email: guest(99), fullName: "Spoofer" } });
  check("signed-in user registers", r.status === 200, r);
  r = await api("GET", `/api/webinars/${w.id}/registrations`, { as: host });
  const regs = r.json?.data ?? [];
  check("host lists 2 registrations", r.status === 200 && regs.length === 2, regs.length);
  check("signed-in registrant recorded under own email, not spoofed one",
    regs.some((x) => x.email === other.email.toLowerCase() && x.userId === other.userId) && !regs.some((x) => x.email === guest(99)));

  r = await api("POST", `/api/webinars/${w.id}/register`, { body: { email: guest(2), fullName: "Guest Two" } });
  check("capacity reached -> 409 webinar_full", r.status === 409 && r.json?.error?.code === "webinar_full", r.json);
  r = await api("GET", `/api/webinars/${w.id}`);
  check("public view reports isFull", r.json?.data?.isFull === true, r.json?.data);

  // Concurrency: free one seat, then race 5 guests for it.
  r = await api("PATCH", `/api/webinars/${w.id}/registrations/${g1}`, { as: host, body: { status: "cancelled" } });
  check("host cancels a registration", r.status === 200 && r.json?.data?.status === "cancelled", r);
  const race = await Promise.all([3, 4, 5, 6, 7].map((n) =>
    api("POST", `/api/webinars/${w.id}/register`, { body: { email: guest(n), fullName: `Racer ${n}` } })));
  const winners = race.filter((x) => x.status === 200).length;
  check("concurrent registrations never exceed capacity (exactly 1 wins)", winners === 1, race.map((x) => x.status));

  r = await api("POST", `/api/webinars/${w.id}/register`, { body: { email: guest(1), fullName: "Guest One" } });
  check("cancelled registrant can't rejoin a full webinar (409)", r.status === 409, r.json);

  // Approval flow
  r = await api("PATCH", `/api/webinars/${w.id}`, { as: host, body: { capacity: null, requiresApproval: true } });
  check("host updates webinar (capacity off, approval on)", r.status === 200 && r.json?.data?.requiresApproval === true, r);
  r = await api("POST", `/api/webinars/${w.id}/register`, { body: { email: guest(8), fullName: "Needs Approval" } });
  check("approval-required registration -> pending", r.json?.data?.status === "pending", r.json);
  const pendingId = r.json?.data?.registrationId;
  r = await api("PATCH", `/api/webinars/${w.id}/registrations/${pendingId}`, { as: other, body: { status: "approved" } });
  check("other user cannot approve (404)", r.status === 404, r.status);
  r = await api("PATCH", `/api/webinars/${w.id}/registrations/${pendingId}`, { as: host, body: { status: "approved" } });
  check("host approves pending registration", r.json?.data?.status === "approved", r.json);
  r = await api("POST", `/api/webinars/${w.id}/register`, { body: { email: guest(1), fullName: "Guest One Again" } });
  check("cancelled registrant reactivates (same id, pending)", r.json?.data?.registrationId === g1 && r.json?.data?.status === "pending", r.json);

  // Direct database access with the public key (bypassing the API)
  const anon = anonClient();
  let d = await anon.from("webinars").select("id").eq("id", w.id);
  check("RLS: anon can't read webinars table", !d.error && d.data.length === 0, d);
  d = await anon.from("registrations").select("id").eq("webinar_id", w.id);
  check("RLS: anon can't read registrations", !d.error && d.data.length === 0, d);
  d = await anon.from("registrations").insert({ webinar_id: w.id, email: guest(50), full_name: "x", status: "approved" });
  check("RLS: anon can't insert registrations directly", Boolean(d.error), d);
  d = await other.client.from("webinars").update({ title: "hijacked" }).eq("id", w.id).select("id");
  check("RLS: other user's direct update affects 0 rows", !d.error && d.data.length === 0, d);
  d = await host.client.from("webinars").update({ status: "live" }).eq("id", w.id).select("id");
  check("trigger: host can't set status=live directly", d.error?.message === "invalid_status_transition", d.error);
  d = await host.client.from("webinars").update({ host_id: other.userId }).eq("id", w.id).select("id");
  check("grants: host can't change host_id", Boolean(d.error), d);
  d = await host.client.from("registrations").update({ email: "changed@example.com" }).eq("id", pendingId).select("id");
  check("grants: host can't edit registrant email", Boolean(d.error), d);
  d = await other.client.from("registrations").select("id, webinar_id").eq("webinar_id", w.id);
  check("RLS: registrant sees only own registration", !d.error && d.data.length === 1, d.data?.length);

  // Close registration, then delete
  r = await api("PATCH", `/api/webinars/${w.id}`, { as: host, body: { status: "cancelled" } });
  check("host cancels webinar", r.json?.data?.status === "cancelled", r.json);
  r = await api("POST", `/api/webinars/${w.id}/register`, { body: { email: guest(9), fullName: "Too Late" } });
  check("registration on cancelled webinar -> 409 registration_closed", r.json?.error?.code === "registration_closed", r.json);

  r = await api("DELETE", `/api/webinars/${w.id}`, { as: host });
  check("host DELETE -> 204", r.status === 204, r.status);
  if (r.status === 204) created.splice(created.indexOf(w.id), 1);
  r = await api("GET", `/api/webinars/${w.id}`, { as: host });
  check("deleted webinar -> 404", r.status === 404, r.status);
  d = await other.client.from("registrations").select("id").eq("webinar_id", w.id);
  check("registrations cascade-deleted", !d.error && d.data.length === 0, d);
} finally {
  for (const id of created) {
    const r = await api("DELETE", `/api/webinars/${id}`, { as: host });
    console.log(`cleanup: delete ${id} -> ${r.status}`);
  }
  await host.client.auth.signOut({ scope: "local" });
  await other.client.auth.signOut({ scope: "local" });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exit(failed.length ? 1 : 0);
