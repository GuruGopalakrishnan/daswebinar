// Safety checks for scripts/staging-check.mjs. The check script calls verifyStagingTarget() before it creates any
// client, and the ownership helpers before it deletes anything.
// Tests: scripts/staging-guard.test.mjs (npm run test:staging-guard).
//
// Keys: Supabase publishable (sb_publishable_...) and secret (sb_secret_...) keys. They are opaque, so unlike
// legacy JWT keys they don't say which project they belong to. After every local check passes, ownership is proven
// with two read-only GET requests sent only to the approved staging host (see probeKeys). The Supabase gateway
// rejects a key from any other project with 401, so a 200 from the approved host proves the key is that project's.
// Anything other than 200, a redirect, a timeout or a network error stops the run. Key values never appear in
// messages.

// Never a staging target. xktlibiflgzsuonutsxe is production (the live app). rplbnqpbdanqhnugzyxy is an
// older project whose dependants aren't verified yet; keep it here until they are.
export const PROTECTED_REFS = Object.freeze(["xktlibiflgzsuonutsxe", "rplbnqpbdanqhnugzyxy"]);

// Staging projects approved for the check script. Add a ref here only in a reviewed commit, after confirming
// in the dashboard that it is a new, empty staging project. Empty = the script refuses every target.
export const APPROVED_STAGING_REFS = Object.freeze([]);

const REF_RE = /^[a-z]{20}$/;
const PUBLISHABLE_RE = /^sb_publishable_[A-Za-z0-9_-]{16,}$/;
const SECRET_RE = /^sb_secret_[A-Za-z0-9_-]{16,}$/;
const PROBE_TIMEOUT_MS = 10_000;

export class StagingGuardError extends Error {}
const fail = (msg) => {
  throw new StagingGuardError(msg);
};

// Local checks only, no network. Throws StagingGuardError unless every source agrees on one approved, unprotected
// staging ref and the keys look like this project's publishable and secret keys.
//   approvedArg   --approved-ref=<ref> from the command line (the operator's explicit choice)
//   env           STAGING_* values from .env.staging.local
//   linkedRef     contents of supabase/.temp/project-ref (null if not linked)
//   otherEnvText  contents of the app's own env files (.env, .env.local, .env.production...), joined
// Returns the ref.
export function assertStagingTarget({
  approvedArg,
  env,
  linkedRef,
  otherEnvText = "",
  approvedRefs = APPROVED_STAGING_REFS,
  protectedRefs = PROTECTED_REFS,
}) {
  const target = String(approvedArg ?? "").trim();
  if (!target) fail("Missing --approved-ref=<staging ref>. Refusing to run.");
  if (!REF_RE.test(target)) fail(`--approved-ref "${target}" is not a Supabase project ref.`);
  if (protectedRefs.includes(target)) fail(`${target} is a protected project. Refusing to run.`);
  if (!approvedRefs.includes(target)) fail(`${target} is not in APPROVED_STAGING_REFS (scripts/staging-guard.mjs).`);

  // Every other source must name the same project. None of them can approve a ref on its own.
  for (const k of ["STAGING_SUPABASE_URL", "STAGING_SUPABASE_PUBLISHABLE_KEY", "STAGING_SUPABASE_SECRET_KEY"]) {
    if (!env[k]) fail(`Missing ${k} in .env.staging.local.`);
  }
  if (env.STAGING_PROJECT_REF && env.STAGING_PROJECT_REF !== target) fail(`STAGING_PROJECT_REF (${env.STAGING_PROJECT_REF}) is not ${target}.`);
  let host;
  try {
    const u = new URL(env.STAGING_SUPABASE_URL);
    host = u.protocol === "https:" && (u.pathname === "/" || u.pathname === "") && !u.search && !u.username ? u.host : null;
  } catch {
    host = null;
  }
  if (!host) fail("STAGING_SUPABASE_URL is not a plain https Supabase URL.");
  if (host !== `${target}.supabase.co`) fail(`STAGING_SUPABASE_URL points at ${host}, not ${target}.supabase.co.`);
  if (!linkedRef) fail(`The repo isn't linked. Run: npx supabase link --project-ref ${target}`);
  if (linkedRef.trim() !== target) fail(`supabase/.temp/project-ref is ${linkedRef.trim()}, not ${target}.`);
  for (const p of protectedRefs) {
    if ([env.STAGING_SUPABASE_URL, env.STAGING_PROJECT_REF].some((v) => String(v ?? "").includes(p))) fail(`.env.staging.local mentions protected project ${p}.`);
  }

  const pub = env.STAGING_SUPABASE_PUBLISHABLE_KEY;
  const sec = env.STAGING_SUPABASE_SECRET_KEY;
  if (!PUBLISHABLE_RE.test(pub)) fail("STAGING_SUPABASE_PUBLISHABLE_KEY is not a publishable key (sb_publishable_...).");
  if (!SECRET_RE.test(sec)) fail("STAGING_SUPABASE_SECRET_KEY is not a secret key (sb_secret_...).");

  // The app's own env files hold the app's project (production): its ref or either key there means this is not a
  // separate staging project.
  if (otherEnvText.includes(target)) fail(`The app's own env files mention ${target}: that's the app's project, not a separate staging one.`);
  if (otherEnvText.includes(pub)) fail("STAGING_SUPABASE_PUBLISHABLE_KEY also appears in the app's own env files.");
  if (otherEnvText.includes(sec)) fail("STAGING_SUPABASE_SECRET_KEY also appears in the app's own env files.");
  return target;
}

// Read-only proof that both keys belong to `target`. Only called by verifyStagingTarget, after every local check has
// passed. Requests go only to https://<target>.supabase.co, with the key in the apikey header. Only the status code
// is read; each response body is cancelled without being read, parsed or logged.
//   publishable: GET /auth/v1/settings                        -> 200 only for a key of this project
//   secret:      GET /auth/v1/admin/users?page=1&per_page=1   -> 200 only for a secret key of this project
// Note: a 200 from the admin endpoint means the server sent back up to one user record from the staging project.
// It is discarded unread, but the request does retrieve it.
export async function probeKeys(target, { publishable, secret }, fetchImpl = fetch) {
  const base = `https://${target}.supabase.co`;
  const probe = async (label, path, key) => {
    let res;
    try {
      res = await fetchImpl(base + path, { method: "GET", headers: { apikey: key }, redirect: "manual", signal: AbortSignal.timeout(PROBE_TIMEOUT_MS) });
    } catch {
      fail(`Could not reach ${target}.supabase.co to verify ${label}; refusing to run.`);
    }
    await res.body?.cancel?.().catch(() => {});
    if (res.status !== 200) fail(`${label} was not accepted by ${target} (HTTP ${res.status}); it isn't this project's key.`);
  };
  await probe("STAGING_SUPABASE_PUBLISHABLE_KEY", "/auth/v1/settings", publishable);
  await probe("STAGING_SUPABASE_SECRET_KEY", "/auth/v1/admin/users?page=1&per_page=1", secret);
}

// Local checks, then the key probes. Nothing is sent anywhere unless every local check passes.
export async function verifyStagingTarget(opts, fetchImpl = fetch) {
  const target = assertStagingTarget(opts);
  await probeKeys(target, { publishable: opts.env.STAGING_SUPABASE_PUBLISHABLE_KEY, secret: opts.env.STAGING_SUPABASE_SECRET_KEY }, fetchImpl);
  return target;
}

// Cleanup only deletes rows this run created, re-checked against what the database returns.
export const testEmail = (run, label) => `${run}-${label}@example.com`;
export function isOwnedTestUser(user, run, createdIds) {
  if (!user || !createdIds.includes(user.id)) return false;
  if (user.user_metadata?.staging_run !== run) return false;
  return user.is_anonymous === true || (typeof user.email === "string" && user.email.startsWith(`${run}-`) && user.email.endsWith("@example.com"));
}
export function isOwnedTestWebinar(webinar, run, createdIds, ownedUserIds) {
  if (!webinar || !createdIds.includes(webinar.id)) return false;
  return ownedUserIds.includes(webinar.host_id) && typeof webinar.title === "string" && webinar.title.endsWith(` ${run}`);
}
