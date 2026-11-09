// Phase 4 integration check against a STAGING Supabase project (never production).
//
//   1. Add the staging ref to APPROVED_STAGING_REFS in scripts/staging-guard.mjs (a reviewed commit).
//   2. Create .env.staging.local (gitignored by .env*) with:
//        STAGING_PROJECT_REF=abcdefghijklmnopqrst   optional; must match if set
//        STAGING_SUPABASE_URL=https://abcdefghijklmnopqrst.supabase.co
//        STAGING_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...  client-level access (signed-out, guests, users)
//        STAGING_SUPABASE_SECRET_KEY=sb_secret_...            server-side only: creates and deletes test users
//        STAGING_APP_URL=http://127.0.0.1:3123  optional: an app build pointed at staging, for HTTP checks
//   3. npx supabase link --project-ref <ref>, then apply the migrations (docs/staging-runbook.md).
//   4. node scripts/staging-check.mjs --approved-ref=<ref>
//
// Refuses to run unless the flag, the approved list, the linked project and the URL all name the same unprotected
// ref, neither key appears in the app's env files, and that project's own API accepts both keys (two read-only
// probes; scripts/staging-guard.mjs). Key values are never printed. Creates confirmed test users (@example.com, no
// email sent), webinars and registrations tagged with this run, checks the rules, then deletes only rows it can
// confirm it created.
// Requires "Allow anonymous sign-ins" on the staging project.

import { readFileSync, existsSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { verifyStagingTarget, StagingGuardError, isOwnedTestUser, isOwnedTestWebinar, testEmail } from "./staging-guard.mjs";

function loadEnv(file) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
loadEnv(".env.staging.local");

const URL_ = process.env.STAGING_SUPABASE_URL;
const PUBLISHABLE = process.env.STAGING_SUPABASE_PUBLISHABLE_KEY;
const SECRET = process.env.STAGING_SUPABASE_SECRET_KEY;
const APP = process.env.STAGING_APP_URL;

// --- safety: staging only (fails closed; see scripts/staging-guard.mjs) ------------------
let REF;
try {
  const read = (f) => (existsSync(f) ? readFileSync(f, "utf8") : "");
  REF = await verifyStagingTarget({
    approvedArg: process.argv.find((a) => a.startsWith("--approved-ref="))?.slice("--approved-ref=".length),
    env: process.env,
    linkedRef: read("supabase/.temp/project-ref") || null,
    otherEnvText: [".env", ".env.local", ".env.production", ".env.production.local"].map(read).join("\n"),
  });
} catch (e) {
  if (!(e instanceof StagingGuardError)) throw e;
  console.error(`Refusing to run: ${e.message}`);
  process.exit(2);
}

// --- harness -----------------------------------------------------------------------------
const results = [];
const check = (ok, label, extra = "") => {
  results.push(ok);
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
};
const admin = createClient(URL_, SECRET, { auth: { persistSession: false, autoRefreshToken: false } });
const fresh = () => createClient(URL_, PUBLISHABLE, { auth: { persistSession: false, autoRefreshToken: false } });
const run = `stg${Date.now().toString(36)}`;
const created = { users: [], webinars: [] };
const password = `T3st-${randomUUID()}`;

async function account(label) {
  const email = testEmail(run, label);
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { full_name: `${label} ${run}`, staging_run: run } });
  if (error) throw new Error(`createUser ${label}: ${error.message}`);
  created.users.push(data.user.id);
  const client = fresh();
  const signIn = await client.auth.signInWithPassword({ email, password });
  return { id: data.user.id, email, client, signInError: signIn.error };
}
async function guest(name) {
  const client = fresh();
  const { data, error } = await client.auth.signInAnonymously({ options: { data: { full_name: name, staging_run: run } } });
  if (error) throw new Error(`Anonymous sign-in failed (${error.message}). Enable it in staging: Authentication → Sign In / Providers.`);
  created.users.push(data.user.id);
  return { id: data.user.id, client };
}
const future = new Date(Date.now() + 3 * 86400_000).toISOString();
async function webinar(host, title, patch = {}) {
  const { data, error } = await host.client.from("webinars").insert({ title, starts_at: future, status: "scheduled", visibility: "public", ...patch }).select("id, slug").single();
  if (error) throw new Error(`create webinar "${title}": ${error.message}`);
  created.webinars.push(data.id);
  return data;
}
const register = (who, webinarId, email, answers = {}) =>
  who.client.rpc("register_for_webinar", { p_webinar_id: webinarId, p_email: email, p_full_name: "Test Person", p_answers: answers });
const bySlug = (client, slug) => client.rpc("get_public_webinar_by_slug", { p_slug: slug });

try {
  console.log(`Staging project ${REF}, run ${run}\n`);

  // Accounts and login
  const host = await account("host");
  check(!host.signInError, "real password sign-in works for a confirmed account", host.signInError?.message ?? "");
  const wrong = await fresh().auth.signInWithPassword({ email: host.email, password: "wrong-password" });
  check(Boolean(wrong.error), "wrong password is rejected");
  const other = await account("otherhost");
  const attendee = await account("attendee");
  // Pro for the host so it can create several webinars (Free allows one); service role only.
  await admin.from("subscriptions").upsert({ user_id: host.id, plan: "pro", status: "active", current_period_end: new Date(Date.now() + 30 * 86400_000).toISOString() });

  // Slugs and privacy
  const pub = await webinar(host, `Staging Masterclass ${run}`);
  check(/^[a-z0-9]+(-[a-z0-9]+)*$/.test(pub.slug ?? ""), "new webinar gets a database-generated slug", pub.slug ?? "(none)");
  const twin = await webinar(host, `Staging Masterclass ${run}`);
  check(twin.slug === `${pub.slug}-2`, "duplicate title gets -2", twin.slug ?? "");
  const unlisted = await webinar(host, `Staging Private ${run}`, { visibility: "unlisted" });
  const draft = await webinar(host, `Staging Draft ${run}`, { status: "draft" });
  const anon = fresh();
  check(((await bySlug(anon, pub.slug)).data ?? []).length === 1, "signed-out visitor resolves a public webinar by slug");
  check(((await bySlug(anon, unlisted.slug)).data ?? []).length === 0, "unlisted webinar does not resolve by slug");
  check(((await bySlug(anon, draft.slug)).data ?? []).length === 0, "draft webinar does not resolve by slug");
  check(((await anon.rpc("get_public_webinar", { p_webinar_id: unlisted.id })).data ?? []).length === 1, "unlisted webinar still opens by id (/register/<id>)");
  await host.client.from("webinars").update({ visibility: "unlisted" }).eq("id", pub.id);
  check(((await bySlug(anon, pub.slug)).data ?? []).length === 0, "switching to unlisted stops the slug resolving");
  await host.client.from("webinars").update({ visibility: "public" }).eq("id", pub.id);
  const slugUpdate = await host.client.from("webinars").update({ slug: "hijack" }).eq("id", pub.id);
  check(Boolean(slugUpdate.error), "hosts cannot change a slug", slugUpdate.error?.message ?? "");

  // Registration, capacity, approval
  const small = await webinar(host, `Staging One Seat ${run}`, { capacity: 1 });
  const gA = await guest("Guest A");
  const gB = await guest("Guest B");
  const rA = await register(gA, small.id, `${run}-a@example.com`);
  check(rA.data?.[0]?.registration_status === "approved", "guest registers (approved)", rA.error?.message ?? "");
  const rB = await register(gB, small.id, `${run}-b@example.com`);
  check(rB.error?.message === "webinar_full", "capacity limit stops the second registration", rB.error?.message ?? "no error");
  const appr = await webinar(host, `Staging Approval ${run}`, { requires_approval: true });
  const rP = await register(gB, appr.id, `${run}-b@example.com`);
  check(rP.data?.[0]?.registration_status === "pending", "approval webinar registers as pending");
  const regP = rP.data?.[0]?.registration_id;
  await host.client.from("registrations").update({ status: "approved" }).eq("id", regP);
  const { data: tokRow } = await admin.from("registrations").select("join_token").eq("id", regP).single();
  const preview1 = await anon.rpc("get_join_preview", { p_token: tokRow.join_token });
  check(preview1.data?.[0]?.registration_status === "approved", "host approval is reflected on the join link");

  // Join tokens
  check(((await anon.rpc("get_join_preview", { p_token: randomUUID() })).data ?? []).length === 0, "unknown token shows nothing");
  const bad = await gA.client.rpc("claim_registration", { p_token: randomUUID() });
  check(bad.error?.message === "invalid_join_link", "unknown token cannot be claimed");
  const moved = await gA.client.rpc("claim_registration", { p_token: tokRow.join_token });
  check(!moved.error, "another guest session can claim a guest-held link (device switch)");
  const rAcct = await register(attendee, pub.id, attendee.email);
  const { data: acctTok } = await admin.from("registrations").select("join_token").eq("id", rAcct.data?.[0]?.registration_id).single();
  const steal = await gB.client.rpc("claim_registration", { p_token: acctTok.join_token });
  check(steal.error?.message === "join_link_claimed", "an account-held link cannot be taken by a guest");

  // Revoked access
  await host.client.from("registrations").update({ status: "rejected" }).eq("id", rAcct.data?.[0]?.registration_id);
  const revoked = await anon.rpc("get_join_preview", { p_token: acctTok.join_token });
  check(revoked.data?.[0]?.registration_status === "rejected", "revoked registration shows as rejected on the join link");
  const roomRead = await attendee.client.rpc("get_room_snapshot", { p_webinar_id: pub.id });
  check(Boolean(roomRead.error), "revoked registrant can no longer read the room", roomRead.error?.message ?? "no error");

  // My events isolation
  const mineA = (await gA.client.rpc("list_my_registrations")).data ?? [];
  check(mineA.length >= 1 && mineA.every((r) => [small.id, appr.id].includes(r.webinar_id)), "guest sees only their own registrations in My events", `${mineA.length} rows`);
  check(((await other.client.rpc("list_my_registrations")).data ?? []).length === 0, "another account sees none of them");
  const anonMine = await anon.rpc("list_my_registrations");
  check(Boolean(anonMine.error), "signed-out visitors cannot list registrations");

  // RLS
  check(((await other.client.from("webinars").select("id").eq("id", pub.id)).data ?? []).length === 0, "another host cannot read the webinar");
  const otherUpd = await other.client.from("webinars").update({ title: "x" }).eq("id", pub.id).select("id");
  check((otherUpd.data ?? []).length === 0, "another host cannot update the webinar");
  check(((await gA.client.from("webinars").select("id")).data ?? []).length === 0, "guests cannot read the webinars table");
  check(((await anon.from("registrations").select("id")).data ?? []).length === 0, "signed-out visitors cannot read registrations");
  check(((await other.client.from("registrations").select("id").eq("webinar_id", small.id)).data ?? []).length === 0, "another host cannot read these registrations");
  const guestHost = await gA.client.from("webinars").insert({ title: `Guest host ${run}`, starts_at: future }).select("id");
  if (guestHost.data?.[0]?.id) created.webinars.push(guestHost.data[0].id);
  check(Boolean(guestHost.error), "guests cannot create webinars");

  // App HTTP (optional)
  if (APP) {
    const status = async (p) => (await fetch(APP + p, { redirect: "manual" })).status;
    check((await status(`/e/${pub.slug}`)) === 200, "app: /e/<public slug> is 200");
    check((await status(`/e/${unlisted.slug}`)) === 404, "app: /e/<unlisted slug> is 404");
    check((await status(`/e/no-such-${run}`)) === 404, "app: /e/<unknown> is 404");
    check((await status(`/register/${unlisted.id}`)) === 200, "app: /register/<unlisted id> is 200");
    check((await status(`/join/${tokRow.join_token}`)) === 200, "app: /join/<token> is 200");
  } else {
    console.log("SKIP  app HTTP checks (set STAGING_APP_URL)");
  }
} catch (e) {
  check(false, "run aborted", e.message);
} finally {
  // Delete only what this run created, re-checked against the stored row (tag, email, title, host).
  const owned = [];
  for (const id of created.users) {
    const { data } = await admin.auth.admin.getUserById(id);
    if (isOwnedTestUser(data?.user, run, created.users)) owned.push(id);
    else console.log(`KEEP  user ${id}: not recognised as this run's test user`);
  }
  let removedWebinars = 0;
  for (const id of created.webinars) {
    const { data } = await admin.from("webinars").select("id, host_id, title").eq("id", id).maybeSingle();
    if (!isOwnedTestWebinar(data, run, created.webinars, owned)) {
      console.log(`KEEP  webinar ${id}: not recognised as this run's test webinar`);
      continue;
    }
    const del = await admin.from("webinars").delete().eq("id", id).eq("host_id", data.host_id).eq("title", data.title);
    if (!del.error) removedWebinars++;
  }
  let removedUsers = 0;
  for (const id of owned) {
    const del = await admin.auth.admin.deleteUser(id).catch((e) => ({ error: e }));
    if (!del?.error) removedUsers++;
  }
  console.log(`\nCleaned up ${removedWebinars}/${created.webinars.length} webinars and ${removedUsers}/${created.users.length} users.`);
  const failed = results.filter((r) => !r).length;
  console.log(`${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}
