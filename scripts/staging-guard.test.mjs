// Tests for scripts/staging-guard.mjs. No network, no real keys: keys below are fakes and fetch is a stub that
// plays the Supabase gateway (200 only for the right project's key).
// npm run test:staging-guard
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertStagingTarget,
  verifyStagingTarget,
  probeKeys,
  StagingGuardError,
  PROTECTED_REFS,
  APPROVED_STAGING_REFS,
  isOwnedTestUser,
  isOwnedTestWebinar,
  testEmail,
} from "./staging-guard.mjs";

const PROD = "xktlibiflgzsuonutsxe";
const OTHER = "rplbnqpbdanqhnugzyxy";
const STAGE = "stagingrefabcdefghij";
const STRAY = "strayrefabcdefghijkl";

const pubKey = (ref) => `sb_publishable_${ref}FAKEpub0000`;
const secKey = (ref) => `sb_secret_${ref}FAKEsec00000000`;
const ALL_KEYS = [PROD, OTHER, STAGE, STRAY].flatMap((r) => [pubKey(r), secKey(r)]);
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const legacyJwt = (ref, role) => `${b64({ alg: "HS256" })}.${b64({ iss: "supabase", ref, role })}.sig`;

// A fully consistent setup for `ref`; each test breaks one thing.
function setup(ref = STAGE, over = {}) {
  return {
    approvedArg: ref,
    env: {
      STAGING_PROJECT_REF: ref,
      STAGING_SUPABASE_URL: `https://${ref}.supabase.co`,
      STAGING_SUPABASE_PUBLISHABLE_KEY: pubKey(ref),
      STAGING_SUPABASE_SECRET_KEY: secKey(ref),
    },
    linkedRef: `${ref}\n`,
    otherEnvText: "",
    approvedRefs: [STAGE],
    ...over,
  };
}

// Fake gateway: a key is accepted only by its own project, and the admin endpoint only takes a secret key.
function gateway({ status } = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const host = new URL(url).host.replace(".supabase.co", "");
    const key = init.headers.apikey;
    const admin = url.includes("/auth/v1/admin/");
    const ok = admin ? key === secKey(host) : key === pubKey(host) || key === secKey(host);
    return { status: status ?? (ok ? 200 : 401), body: { cancel: async () => {} } };
  };
  return { calls, fetchImpl };
}

const isGuardError = (re) => (e) => {
  assert.ok(e instanceof StagingGuardError, `expected StagingGuardError, got ${e}`);
  assert.match(e.message, re);
  for (const k of ALL_KEYS) assert.ok(!e.message.includes(k), "error message must not contain a key");
  return true;
};
async function rejectsWithoutNetwork(opts, re) {
  const g = gateway();
  await assert.rejects(verifyStagingTarget(opts, g.fetchImpl), isGuardError(re));
  assert.equal(g.calls.length, 0, "nothing may be sent when a local check fails");
}

// --- happy path ---------------------------------------------------------------------------
test("a fully consistent, approved staging target passes, probing only the staging host", async () => {
  const g = gateway();
  assert.equal(await verifyStagingTarget(setup(), g.fetchImpl), STAGE);
  assert.deepEqual(g.calls.map((c) => c.url), [
    `https://${STAGE}.supabase.co/auth/v1/settings`,
    `https://${STAGE}.supabase.co/auth/v1/admin/users?page=1&per_page=1`,
  ]);
  for (const c of g.calls) {
    assert.equal(c.init.method, "GET");
    assert.equal(c.init.redirect, "manual");
    assert.deepEqual(Object.keys(c.init.headers), ["apikey"]);
  }
  assert.equal(g.calls[0].init.headers.apikey, pubKey(STAGE));
  assert.equal(g.calls[1].init.headers.apikey, secKey(STAGE));
});

test("both protected refs are listed and nothing is approved by default", () => {
  assert.deepEqual([...PROTECTED_REFS].sort(), [OTHER, PROD].sort());
  assert.equal(APPROVED_STAGING_REFS.length, 0);
});

test("the local checks alone accept a consistent setup and throw synchronously otherwise", () => {
  assert.equal(assertStagingTarget(setup()), STAGE);
  assert.throws(() => assertStagingTarget(setup(PROD, { approvedRefs: [PROD] })), isGuardError(/protected/));
});

// --- protected refs -------------------------------------------------------------------------
for (const ref of [PROD, OTHER]) {
  test(`protected ${ref}: rejected even when every source agrees and it is approved, with no request sent`, async () => {
    await rejectsWithoutNetwork(setup(ref, { approvedRefs: [ref] }), /protected/);
  });
  test(`protected ${ref}: an env URL pointing at it is rejected`, async () => {
    const s = setup();
    s.env.STAGING_SUPABASE_URL = `https://${ref}.supabase.co`;
    delete s.env.STAGING_PROJECT_REF;
    await rejectsWithoutNetwork(s, /points at/);
  });
  test(`protected ${ref}: STAGING_PROJECT_REF naming it is rejected`, async () => {
    const s = setup();
    s.env.STAGING_PROJECT_REF = ref;
    await rejectsWithoutNetwork(s, /STAGING_PROJECT_REF/);
  });
  test(`protected ${ref}: the repo linked to it is rejected`, async () => {
    await rejectsWithoutNetwork(setup(STAGE, { linkedRef: ref }), /project-ref is/);
  });
  test(`protected ${ref}: its publishable key is refused by the staging host`, async () => {
    const s = setup();
    s.env.STAGING_SUPABASE_PUBLISHABLE_KEY = pubKey(ref);
    const g = gateway();
    await assert.rejects(verifyStagingTarget(s, g.fetchImpl), isGuardError(/PUBLISHABLE_KEY was not accepted by .* \(HTTP 401\)/));
    assert.ok(g.calls.every((c) => c.url.startsWith(`https://${STAGE}.supabase.co/`)), "never sent to the protected host");
  });
  test(`protected ${ref}: its secret key is refused by the staging host`, async () => {
    const s = setup();
    s.env.STAGING_SUPABASE_SECRET_KEY = secKey(ref);
    const g = gateway();
    await assert.rejects(verifyStagingTarget(s, g.fetchImpl), isGuardError(/SECRET_KEY was not accepted by .* \(HTTP 401\)/));
    assert.ok(g.calls.every((c) => !c.url.includes(ref)), "never sent to the protected host");
  });
  test(`protected ${ref}: keys found in the app's env files are rejected before any request`, async () => {
    // The app's env holds the production keys; a copy of them in the staging file is caught locally.
    const s = setup();
    s.env.STAGING_SUPABASE_SECRET_KEY = secKey(ref);
    s.otherEnvText = `SUPABASE_SERVICE_ROLE_KEY=${secKey(ref)}`;
    await rejectsWithoutNetwork(s, /SECRET_KEY also appears in the app's own env files/);
  });
}

// --- approval and ref matching --------------------------------------------------------------
test("the default approved list rejects every ref, including a self-consistent env file", async () => {
  const s = setup();
  delete s.approvedRefs;
  await rejectsWithoutNetwork(s, /not in APPROVED_STAGING_REFS/);
});

test("a self-consistent env file for an unapproved ref is rejected", async () => {
  await rejectsWithoutNetwork(setup(STRAY), /not in APPROVED_STAGING_REFS/);
});

test("missing or malformed --approved-ref is rejected", async () => {
  await rejectsWithoutNetwork(setup(STAGE, { approvedArg: undefined }), /Missing --approved-ref/);
  await rejectsWithoutNetwork(setup(STAGE, { approvedArg: "  " }), /Missing --approved-ref/);
  await rejectsWithoutNetwork(setup(STAGE, { approvedArg: "STAGING", approvedRefs: ["STAGING"] }), /not a Supabase project ref/);
});

test("STAGING_PROJECT_REF that differs from --approved-ref is rejected", async () => {
  const s = setup();
  s.env.STAGING_PROJECT_REF = STRAY;
  await rejectsWithoutNetwork(s, /STAGING_PROJECT_REF/);
});

test("a URL for another project, or a look-alike URL, is rejected", async () => {
  for (const url of [`https://${STRAY}.supabase.co`, `https://${STAGE}.supabase.co.evil.example`, `https://evil.example/${STAGE}.supabase.co`, `http://${STAGE}.supabase.co`, `https://${STAGE}.supabase.co/rest/v1`, `https://user@${STAGE}.supabase.co`, "not a url"]) {
    const s = setup();
    s.env.STAGING_SUPABASE_URL = url;
    await rejectsWithoutNetwork(s, /STAGING_SUPABASE_URL/);
  }
});

test("an unlinked repo, or one linked elsewhere, is rejected", async () => {
  await rejectsWithoutNetwork(setup(STAGE, { linkedRef: null }), /isn't linked/);
  await rejectsWithoutNetwork(setup(STAGE, { linkedRef: STRAY }), /project-ref is/);
});

test("a ref that appears in the app's own env files is rejected", async () => {
  await rejectsWithoutNetwork(setup(STAGE, { otherEnvText: `NEXT_PUBLIC_SUPABASE_URL=https://${STAGE}.supabase.co` }), /app's own env files/);
});

// --- key format and presence ----------------------------------------------------------------
test("missing URL or keys are rejected", async () => {
  for (const k of ["STAGING_SUPABASE_URL", "STAGING_SUPABASE_PUBLISHABLE_KEY", "STAGING_SUPABASE_SECRET_KEY"]) {
    const s = setup();
    delete s.env[k];
    await rejectsWithoutNetwork(s, new RegExp(`Missing ${k}`));
    s.env[k] = "";
    await rejectsWithoutNetwork(s, new RegExp(`Missing ${k}`));
  }
});

test("legacy JWT keys, swapped keys and malformed keys are rejected before any request", async () => {
  const cases = [
    ["STAGING_SUPABASE_PUBLISHABLE_KEY", legacyJwt(STAGE, "anon"), /not a publishable key/],
    ["STAGING_SUPABASE_SECRET_KEY", legacyJwt(STAGE, "service_role"), /not a secret key/],
    ["STAGING_SUPABASE_PUBLISHABLE_KEY", secKey(STAGE), /not a publishable key/],
    ["STAGING_SUPABASE_SECRET_KEY", pubKey(STAGE), /not a secret key/],
    ["STAGING_SUPABASE_SECRET_KEY", "sb_secret_short", /not a secret key/],
    ["STAGING_SUPABASE_PUBLISHABLE_KEY", `sb_publishable_${STAGE} spaces`, /not a publishable key/],
  ];
  for (const [k, v, re] of cases) {
    const s = setup();
    s.env[k] = v;
    await rejectsWithoutNetwork(s, re);
  }
});

test("the staging publishable key found in the app's env files is rejected", async () => {
  // A key that doesn't contain the ref, so only the key check can catch it.
  const s = setup(STAGE, { otherEnvText: "NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_UnrelatedFakeKey0000" });
  s.env.STAGING_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_UnrelatedFakeKey0000";
  await rejectsWithoutNetwork(s, /PUBLISHABLE_KEY also appears/);
});

// --- key ownership probes -------------------------------------------------------------------
test("keys from another (unprotected) project are refused by the staging host", async () => {
  for (const [k, v, re] of [
    ["STAGING_SUPABASE_PUBLISHABLE_KEY", pubKey(STRAY), /PUBLISHABLE_KEY was not accepted/],
    ["STAGING_SUPABASE_SECRET_KEY", secKey(STRAY), /SECRET_KEY was not accepted/],
  ]) {
    const s = setup();
    s.env[k] = v;
    await assert.rejects(verifyStagingTarget(s, gateway().fetchImpl), isGuardError(re));
  }
});

test("a secret key that the admin endpoint refuses fails closed", async () => {
  const fetchImpl = async (url) => ({ status: url.includes("/admin/") ? 403 : 200, body: { cancel: async () => {} } });
  await assert.rejects(probeKeys(STAGE, { publishable: pubKey(STAGE), secret: secKey(STAGE) }, fetchImpl), isGuardError(/SECRET_KEY was not accepted .*HTTP 403/));
});

test("redirects, server errors and network failures fail closed", async () => {
  for (const status of [301, 302, 500, 503]) {
    await assert.rejects(verifyStagingTarget(setup(), gateway({ status }).fetchImpl), isGuardError(new RegExp(`HTTP ${status}`)));
  }
  const down = async () => {
    throw new TypeError("fetch failed");
  };
  await assert.rejects(verifyStagingTarget(setup(), down), isGuardError(/Could not reach/));
});

test("the secret key is never sent when the publishable key fails", async () => {
  const s = setup();
  s.env.STAGING_SUPABASE_PUBLISHABLE_KEY = pubKey(STRAY);
  const g = gateway();
  await assert.rejects(verifyStagingTarget(s, g.fetchImpl), StagingGuardError);
  assert.equal(g.calls.length, 1);
  assert.ok(!JSON.stringify(g.calls).includes(secKey(STAGE)));
});

// --- cleanup ownership ----------------------------------------------------------------------
const run = "stgtest1";
const created = ["u1", "u2", "u3", "u4"];
test("cleanup deletes only tagged users this run created", () => {
  assert.equal(isOwnedTestUser({ id: "u1", email: testEmail(run, "host"), user_metadata: { staging_run: run } }, run, created), true);
  assert.equal(isOwnedTestUser({ id: "u2", email: null, is_anonymous: true, user_metadata: { staging_run: run } }, run, created), true);
  assert.equal(isOwnedTestUser({ id: "real", email: testEmail(run, "host"), user_metadata: { staging_run: run } }, run, created), false, "not created by this run");
  assert.equal(isOwnedTestUser({ id: "u3", email: "someone@gmail.com", user_metadata: { staging_run: run } }, run, created), false, "real email");
  assert.equal(isOwnedTestUser({ id: "u4", email: testEmail(run, "host"), user_metadata: {} }, run, created), false, "untagged");
  assert.equal(isOwnedTestUser({ id: "u1", email: testEmail("stgother", "host"), user_metadata: { staging_run: "stgother" } }, run, created), false, "another run");
  assert.equal(isOwnedTestUser(null, run, created), false);
});

test("cleanup deletes only this run's webinars hosted by its own test users", () => {
  const ids = ["w1", "w2"];
  assert.equal(isOwnedTestWebinar({ id: "w1", host_id: "u1", title: `Staging Masterclass ${run}` }, run, ids, ["u1"]), true);
  assert.equal(isOwnedTestWebinar({ id: "real", host_id: "u1", title: `Staging Masterclass ${run}` }, run, ids, ["u1"]), false, "not created by this run");
  assert.equal(isOwnedTestWebinar({ id: "w2", host_id: "realhost", title: `Staging Masterclass ${run}` }, run, ids, ["u1"]), false, "real host");
  assert.equal(isOwnedTestWebinar({ id: "w2", host_id: "u1", title: "Live client webinar" }, run, ids, ["u1"]), false, "untagged title");
  assert.equal(isOwnedTestWebinar(null, run, ids, ["u1"]), false);
});
