// Database test: applies every migration in supabase/migrations to PGlite (real Postgres 16 in WASM, in
// memory) with small stand-ins for Supabase's auth and realtime schemas, then checks the event-slug migration
// (20261030000000): backfill, slug rules, privacy, registration rules, My events, join tokens, RLS and the
// rollback. No Docker or Supabase project needed. It never connects to a real database.
// Usage: npm run test:db
import { PGlite } from "@electric-sql/pglite";
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";

const supa = process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "supabase");
const migrationsDir = path.join(supa, "migrations");
const NEW = "20261030000000_event_slugs.sql";
const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort();
const before = files.filter((f) => f < NEW);
const rollback = fs.readFileSync(path.join(supa, "rollbacks", "20261030000000_event_slugs.down.sql"), "utf8");
const migration = fs.readFileSync(path.join(migrationsDir, NEW), "utf8");

const db = new PGlite();
let pass = 0, fail = 0;
const ok = (cond, label, extra = "") => { if (cond) pass++; else fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`); };

// --- Supabase-like environment -------------------------------------------------------------
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create schema realtime;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}', is_anonymous boolean not null default false, created_at timestamptz default now());
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
  create table realtime.messages (id bigserial primary key, topic text, extension text, payload jsonb, event text, private boolean, inserted_at timestamptz default now());
  alter table realtime.messages enable row level security;
  create function realtime.topic() returns text language sql stable as $$ select current_setting('realtime.topic', true) $$;
  create function realtime.send(payload jsonb, event text, topic text, private boolean default true) returns void language sql as $$ insert into realtime.messages(topic, extension, payload, event, private) values (topic, 'broadcast', payload, event, private) $$;
  grant usage on schema auth, realtime, public to anon, authenticated, service_role;
  grant execute on all functions in schema auth, realtime to anon, authenticated, service_role;
  grant all on realtime.messages to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`);

for (const f of before) await db.exec(fs.readFileSync(path.join(migrationsDir, f), "utf8"));
ok(true, `applied ${before.length} existing migrations`, before.join(", "));

// --- Acting as users -----------------------------------------------------------------------
async function as(role, uid, isAnon, fn) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claims', $2, false)", [
    uid ?? "",
    uid ? JSON.stringify({ sub: uid, is_anonymous: !!isAnon, role }) : "",
  ]);
  await db.exec(`set role ${role}`);
  try { return await fn(); } finally { await db.exec("reset role"); }
}
const owner = (fn) => as("postgres", null, false, fn);
const tryErr = async (p) => { try { await p; return null; } catch (e) { return e.message; } };

async function makeUser(email, name, anon = false) {
  const id = randomUUID();
  await db.query("insert into auth.users (id, email, raw_user_meta_data, is_anonymous) values ($1, $2, $3, $4)", [id, anon ? null : email, { full_name: name }, anon]);
  return id;
}
const host = await makeUser("host@example.com", "Ananya Rao");
const host2 = await makeUser("host2@example.com", "Other Host");
const acct = await makeUser("priya@example.com", "Priya Sharma");
const guestA = await makeUser(null, "Guest A", true);
const guestB = await makeUser(null, "Guest B", true);

const future = new Date(Date.now() + 3 * 86400_000).toISOString();
async function createWebinar(uid, title, patch = {}) {
  return as("authenticated", uid, false, async () => {
    const cols = { title, starts_at: future, status: "scheduled", visibility: "public", ...patch };
    const keys = Object.keys(cols);
    const r = await db.query(`insert into public.webinars (${keys.join(",")}) values (${keys.map((_, i) => "$" + (i + 1)).join(",")}) returning id`, Object.values(cols));
    return r.rows[0].id;
  });
}

// Pre-existing data (before the new migration)
const old1 = await createWebinar(host, "Growth Masterclass");
// Free plan allows one webinar per account; give the host Pro for the rest of the test.
await owner(() => db.query("insert into public.subscriptions (user_id, plan, status, current_period_end) values ($1, 'pro', 'active', now() + interval '30 days')", [host]));
const old2 = await createWebinar(host, "Growth Masterclass", { visibility: "unlisted" });
const old3 = await createWebinar(host, "!!!", { status: "draft" });
const oldReg = await as("authenticated", guestA, true, async () => (await db.query("select * from public.register_for_webinar($1, 'a@example.com', 'Guest A', '{}'::jsonb)", [old1])).rows[0]);
const snapshot = await owner(async () => (await db.query("select id, updated_at from public.webinars order by id")).rows);
const tokensBefore = await owner(async () => (await db.query("select id, join_token from public.registrations order by id")).rows);

// --- Apply the new migration ---------------------------------------------------------------
await db.exec(migration);
ok(true, "applied " + NEW);

const slugs = await owner(async () => (await db.query("select id, title, slug from public.webinars order by created_at, id")).rows);
ok(slugs.every((r) => /^[a-z0-9]+(-[a-z0-9]+)*$/.test(r.slug)), "backfilled slugs are well-formed", slugs.map((r) => r.slug).join(", "));
ok(new Set(slugs.map((r) => r.slug)).size === slugs.length, "backfilled slugs are unique");
ok(slugs.find((r) => r.id === old3)?.slug === "webinar", "symbol-only title falls back to 'webinar'");
const after = await owner(async () => (await db.query("select id, updated_at from public.webinars order by id")).rows);
ok(JSON.stringify(after) === JSON.stringify(snapshot), "backfill kept webinar ids and updated_at");
const tokensAfter = await owner(async () => (await db.query("select id, join_token from public.registrations order by id")).rows);
ok(JSON.stringify(tokensAfter) === JSON.stringify(tokensBefore), "registration ids and join tokens unchanged");

// --- Generation, collisions, guard ---------------------------------------------------------
const w3 = await createWebinar(host, "Growth Masterclass", { slug: "pricing" });
const w3slug = await owner(async () => (await db.query("select slug from public.webinars where id = $1", [w3])).rows[0].slug);
ok(w3slug === "growth-masterclass-3", "third duplicate title gets -3 and a client-sent slug is ignored", w3slug);
const long = await createWebinar(host, "A".repeat(150) + " very long title");
const longSlug = await owner(async () => (await db.query("select slug from public.webinars where id = $1", [long])).rows[0].slug);
ok(longSlug.length <= 64, "long titles produce slugs of at most 64 chars", `${longSlug.length}`);
const hostUpdate = await tryErr(as("authenticated", host, false, () => db.query("update public.webinars set slug = 'taken' where id = $1", [w3])));
ok(hostUpdate !== null && /permission denied/.test(hostUpdate), "hosts cannot update slug", hostUpdate ?? "");
await owner(() => db.query("update public.webinars set slug = 'changed' where id = $1", [w3]));
const kept = await owner(async () => (await db.query("select slug from public.webinars where id = $1", [w3])).rows[0].slug);
ok(kept === "growth-masterclass-3", "even a privileged update keeps the slug");
const titleEdit = await as("authenticated", host, false, () => db.query("update public.webinars set title = 'Renamed' where id = $1", [w3]));
const kept2 = await owner(async () => (await db.query("select slug from public.webinars where id = $1", [w3])).rows[0].slug);
ok(titleEdit && kept2 === "growth-masterclass-3", "renaming a webinar keeps its slug (shared links keep working)");

// --- Public lookup by slug -----------------------------------------------------------------
const bySlug = (slug, role = "anon", uid = null) => as(role, uid, false, async () => (await db.query("select * from public.get_public_webinar_by_slug($1)", [slug])).rows);
const pub = await bySlug("growth-masterclass");
ok(pub.length === 1 && pub[0].id === old1, "anon resolves a public scheduled webinar by slug");
ok((await bySlug("GROWTH-Masterclass ")).length === 1, "lookup is case- and space-insensitive");
ok((await bySlug("growth-masterclass-2")).length === 0, "unlisted webinar does not resolve by slug");
ok((await bySlug("webinar")).length === 0, "draft webinar does not resolve by slug");
ok((await bySlug("does-not-exist")).length === 0, "unknown slug resolves to nothing");
ok((await as("anon", null, false, async () => (await db.query("select * from public.get_public_webinar($1)", [old2])).rows)).length === 1,
  "unlisted webinar still resolves by its id (/register/<id> unchanged)");

// --- Registration through the slug path keeps every rule ------------------------------------
const register = (uid, anon, webinarId, email, answers = {}) =>
  tryErr(as("authenticated", uid, anon, () => db.query("select * from public.register_for_webinar($1, $2, 'Someone', $3::jsonb)", [webinarId, email, JSON.stringify(answers)])));
const approvalId = await createWebinar(host, "Approval Needed", { requires_approval: true, capacity: 1,
  custom_fields: JSON.stringify([{ id: "goal", label: "Your goal", type: "text", required: true, options: [] }]) });
const approvalSlugId = (await bySlug("approval-needed"))[0]?.id;
ok(approvalSlugId === approvalId, "slug resolves to the webinar id used for registration");
ok((await register(guestA, true, approvalSlugId, "a@example.com")) === "missing_required_answers", "required answers still enforced");
const pendingRow = await as("authenticated", guestA, true, async () => (await db.query("select * from public.register_for_webinar($1, 'a@example.com', 'Guest A', '{\"goal\":\"grow\"}'::jsonb)", [approvalSlugId])).rows[0]);
ok(pendingRow.registration_status === "pending", "approval still required (status pending)");
ok((await register(guestB, true, approvalSlugId, "b@example.com", { goal: "x" })) === "webinar_full", "capacity still enforced (webinar_full)");

// --- My events -----------------------------------------------------------------------------
const mine = (uid, anon) => as("authenticated", uid, anon, async () => (await db.query("select * from public.list_my_registrations()")).rows);
const aEvents = await mine(guestA, true);
ok(aEvents.length === 2 && aEvents.every((r) => [old1, approvalId].includes(r.webinar_id)), "guest A sees exactly their own 2 registrations");
ok((await mine(guestB, true)).length === 0, "guest B sees none of guest A's registrations");
ok((await mine(host, false)).length === 0, "host does not see attendees' registrations via My events");
const anonCall = await tryErr(as("anon", null, false, () => db.query("select * from public.list_my_registrations()")));
ok(anonCall !== null && /permission denied/.test(anonCall), "signed-out (anon) callers cannot call list_my_registrations");
await as("authenticated", host, false, () => db.query("update public.webinars set status = 'draft' where id = $1", [approvalId]).catch(() => null));

// --- Join tokens ---------------------------------------------------------------------------
const tokenOf = async (regId) => owner(async () => (await db.query("select join_token from public.registrations where id = $1", [regId])).rows[0].join_token);
const tokA = await tokenOf(oldReg.registration_id);
const preview = await as("anon", null, false, async () => (await db.query("select * from public.get_join_preview($1)", [tokA])).rows);
ok(preview.length === 1 && preview[0].registration_status === "approved", "valid token previews for anon");
ok((await as("anon", null, false, async () => (await db.query("select * from public.get_join_preview($1)", [randomUUID()])).rows)).length === 0, "unknown token previews nothing");
ok((await tryErr(as("authenticated", guestB, true, () => db.query("select public.claim_registration($1)", [randomUUID()])))) === "invalid_join_link", "unknown token cannot be claimed");
ok((await tryErr(as("authenticated", guestB, true, () => db.query("select public.claim_registration($1)", [tokA])))) === null, "another guest session can claim a guest-held link (device switch)");
await as("authenticated", acct, false, () => db.query("select public.claim_registration($1)", [tokA]));
ok((await tryErr(as("authenticated", guestA, true, () => db.query("select public.claim_registration($1)", [tokA])))) === "join_link_claimed", "an account-held link cannot be taken by a guest");
await as("authenticated", host, false, () => db.query("update public.registrations set status = 'rejected' where id = $1", [oldReg.registration_id]));
const revoked = await as("anon", null, false, async () => (await db.query("select registration_status from public.get_join_preview($1)", [tokA])).rows[0]);
ok(revoked.registration_status === "rejected", "revoked registration shows as rejected on the join page");
// webinar_role is internal (not granted to clients); evaluate it as the owner with the registrant's identity.
const role = await as("postgres", acct, false, async () => (await db.query("select public.webinar_role($1) as r", [old1])).rows[0].r);
ok(role === null, "revoked registrant has no room role");

// --- RLS isolation -------------------------------------------------------------------------
ok((await as("authenticated", host2, false, async () => (await db.query("select id from public.webinars")).rows)).length === 0, "another host cannot read these webinars");
ok((await as("authenticated", guestA, true, async () => (await db.query("select id from public.webinars")).rows)).length === 0, "registrants cannot read the webinars table directly");
ok((await as("anon", null, false, async () => (await db.query("select id from public.registrations")).rows)).length === 0, "anon cannot read registrations");

// --- Rollback and re-apply -----------------------------------------------------------------
await db.exec(rollback);
const col = await owner(async () => (await db.query("select count(*)::int n from information_schema.columns where table_name = 'webinars' and column_name = 'slug'")).rows[0].n);
ok(col === 0, "rollback removes webinars.slug");
const fns = await owner(async () => (await db.query("select count(*)::int n from pg_proc where proname in ('get_public_webinar_by_slug','list_my_registrations','slugify','next_webinar_slug','webinars_slug_guard')")).rows[0].n);
ok(fns === 0, "rollback removes the new functions");
ok((await as("anon", null, false, async () => (await db.query("select * from public.get_public_webinar($1)", [old1])).rows)).length === 1, "after rollback /register/<id> lookup still works");
ok(JSON.stringify(await owner(async () => (await db.query("select id, join_token from public.registrations where id = $1", [oldReg.registration_id])).rows)) ===
  JSON.stringify(tokensBefore.filter((t) => t.id === oldReg.registration_id)), "after rollback join tokens are unchanged");
const okCreate = await createWebinar(host, "After Rollback").then(() => true, () => false);
ok(okCreate, "after rollback hosts can still create webinars");
await db.exec(migration);
ok((await bySlug("growth-masterclass")).length === 1, "migration re-applies cleanly after rollback");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
