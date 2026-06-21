// End-to-end verification of the OIDC identity provider.
// Drives the full Authorization Code + PKCE flow against a running dev server,
// validates tokens against JWKS, and exercises refresh rotation + reuse detection.
//
// Usage: bun scripts/verify-oidc.mjs   (optionally BASE_URL=http://localhost:3001)
import { createHash, randomBytes } from "node:crypto";
import { Redis } from "@upstash/redis";
import { PrismaPg } from "@prisma/adapter-pg";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { PrismaClient } from "../lib/generated/prisma/client.ts";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const ISSUER = process.env.ISSUER ?? "http://localhost:3000";
const REDIRECT = "https://app.example.com/callback";
const SCOPE = "openid profile email offline_access";

let pass = 0;
let fail = 0;
function check(name, ok) {
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (ok) pass++;
  else fail++;
}
const form = (obj) =>
  fetch(`${BASE}/api/oidc/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(obj),
  }).then((r) => r.json());

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.POSTGRES_PRISMA_URL }),
});

const verifier = randomBytes(32).toString("base64url");
const challenge = createHash("sha256").update(verifier).digest("base64url");

let user;
let client;
try {
  // --- Discovery + JWKS ---
  const disco = await (
    await fetch(`${BASE}/.well-known/openid-configuration`)
  ).json();
  check("discovery: issuer matches", disco.issuer === ISSUER);
  check(
    "discovery: S256 supported",
    disco.code_challenge_methods_supported?.includes("S256"),
  );
  check(
    "discovery: authorization_code + refresh_token",
    disco.grant_types_supported?.includes("authorization_code") &&
      disco.grant_types_supported?.includes("refresh_token"),
  );
  const jwks = await (await fetch(`${BASE}/.well-known/jwks.json`)).json();
  check("jwks: has signing key", (jwks.keys?.length ?? 0) >= 1);

  // --- Seed an authenticated, fully-registered user via the magic-link route ---
  const email = `oidc+${Date.now()}@example.com`;
  const mlToken = `vt${randomBytes(16).toString("hex")}`;
  await redis.set(`ml:${mlToken}`, { email, locale: "en" }, { ex: 300 });
  const verify = await fetch(`${BASE}/auth/verify?token=${mlToken}`, {
    redirect: "manual",
  });
  const cookie = (verify.headers.get("set-cookie") ?? "").match(
    /auth_session=[^;]+/,
  )?.[0];
  check("magic link: session cookie issued", Boolean(cookie));
  user = await prisma.user.update({
    where: { email },
    data: { username: `oidc${Date.now()}`.slice(0, 24), firstName: "Test" },
  });

  // --- Register a (non-trusted) client ---
  client = await prisma.client.create({
    data: {
      clientId: `test-${Date.now()}`,
      name: "Verification App",
      redirectUris: [REDIRECT],
      trusted: false,
      allowedScopes: ["openid", "profile", "email", "offline_access"],
    },
  });

  const authUrl =
    `${BASE}/api/oidc/authorize?response_type=code&client_id=${client.clientId}` +
    `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
    `&scope=${encodeURIComponent(SCOPE)}&state=xyz` +
    `&code_challenge=${challenge}&code_challenge_method=S256&nonce=nnn`;

  // --- Consent gate: not linked -> redirect to /consent ---
  const r1 = await fetch(authUrl, { headers: { cookie }, redirect: "manual" });
  check(
    "authorize: unlinked client -> consent screen",
    (r1.headers.get("location") ?? "").includes("/consent"),
  );

  // Approve by linking (what the consent action does)
  await prisma.appMembership.create({
    data: {
      userId: user.id,
      clientId: client.id,
      roles: ["USER"],
      scopesGranted: SCOPE.split(" "),
    },
  });

  // --- Authorize -> code ---
  const r2 = await fetch(authUrl, { headers: { cookie }, redirect: "manual" });
  const loc = r2.headers.get("location") ?? "";
  check("authorize: redirects to redirect_uri", loc.startsWith(REDIRECT));
  const back = new URL(loc);
  check("authorize: state preserved", back.searchParams.get("state") === "xyz");
  const code = back.searchParams.get("code");
  check("authorize: code issued", Boolean(code));

  // --- Bad redirect_uri rejected (400, no open redirect) ---
  const badRedir = await fetch(
    `${BASE}/api/oidc/authorize?response_type=code&client_id=${client.clientId}` +
      `&redirect_uri=${encodeURIComponent("https://evil.example/cb")}` +
      `&scope=openid&code_challenge=${challenge}&code_challenge_method=S256`,
    { headers: { cookie }, redirect: "manual" },
  );
  check("authorize: invalid redirect_uri -> 400", badRedir.status === 400);

  // --- Token exchange ---
  const tokens = await form({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
    client_id: client.clientId,
  });
  check("token: access_token present", Boolean(tokens.access_token));
  check("token: id_token present", Boolean(tokens.id_token));
  check(
    "token: refresh_token present (offline_access)",
    Boolean(tokens.refresh_token),
  );
  check("token: token_type Bearer", tokens.token_type === "Bearer");

  // --- Validate access token against JWKS ---
  const JWKS = createRemoteJWKSet(new URL(`${BASE}/.well-known/jwks.json`));
  const { payload: at } = await jwtVerify(tokens.access_token, JWKS, {
    issuer: ISSUER,
    audience: client.clientId,
  });
  check("access token: sub is user id", at.sub === user.id);
  check(
    "access token: roles is array with USER",
    Array.isArray(at.roles) && at.roles.includes("USER"),
  );
  check("access token: admin claim is false for non-admin", at.admin === false);
  check("access token: email claim", at.email === email);
  check(
    "access token: preferred_username claim",
    at.preferred_username === user.username,
  );

  const { payload: idt } = await jwtVerify(tokens.id_token, JWKS, {
    issuer: ISSUER,
    audience: client.clientId,
  });
  check("id token: nonce echoed", idt.nonce === "nnn");

  // --- UserInfo ---
  const ui = await (
    await fetch(`${BASE}/api/oidc/userinfo`, {
      headers: { authorization: `Bearer ${tokens.access_token}` },
    })
  ).json();
  check("userinfo: sub matches", ui.sub === user.id);
  check("userinfo: email matches", ui.email === email);
  const uiNoAuth = await fetch(`${BASE}/api/oidc/userinfo`);
  check("userinfo: 401 without token", uiNoAuth.status === 401);

  // --- Consumed code can't be reused ---
  const replay = await form({
    grant_type: "authorization_code",
    code,
    redirect_uri: REDIRECT,
    code_verifier: verifier,
    client_id: client.clientId,
  });
  check("token: consumed code rejected", replay.error === "invalid_grant");

  // --- Refresh rotation ---
  const original = tokens.refresh_token;
  const rotated = await form({
    grant_type: "refresh_token",
    refresh_token: original,
    client_id: client.clientId,
  });
  check("refresh: new access token", Boolean(rotated.access_token));
  check(
    "refresh: rotated refresh token differs",
    Boolean(rotated.refresh_token) && rotated.refresh_token !== original,
  );

  // --- Reuse detection: old token replay revokes the family ---
  const reuse = await form({
    grant_type: "refresh_token",
    refresh_token: original,
    client_id: client.clientId,
  });
  check("refresh: reused old token rejected", reuse.error === "invalid_grant");
  const afterReuse = await form({
    grant_type: "refresh_token",
    refresh_token: rotated.refresh_token,
    client_id: client.clientId,
  });
  check(
    "refresh: family revoked after reuse",
    afterReuse.error === "invalid_grant",
  );

  // --- Logout ---
  const logout = await fetch(`${BASE}/api/oidc/logout`, {
    headers: { cookie },
    redirect: "manual",
  });
  check("logout: redirects", logout.status === 307 || logout.status === 302);
} finally {
  // Cleanup
  if (user) {
    await prisma.refreshToken.deleteMany({ where: { userId: user.id } });
    await prisma.appMembership.deleteMany({ where: { userId: user.id } });
    await prisma.session.deleteMany({ where: { userId: user.id } });
  }
  if (client)
    await prisma.client.delete({ where: { id: client.id } }).catch(() => {});
  if (user)
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
