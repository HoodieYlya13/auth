import "server-only";
import { SignJWT } from "jose";
import { getPrivateKey, SIGNING_ALG, SIGNING_KID } from "@/lib/oidc/keys";
import { avatarUrl } from "@/lib/avatar/avatar";
import type { User } from "@/lib/generated/prisma/client";

const ISSUER = process.env.ISSUER ?? "";
const ACCESS_TOKEN_TTL = Number(process.env.ACCESS_TOKEN_TTL ?? 900);
const ID_TOKEN_TTL = Number(process.env.ID_TOKEN_TTL ?? 900);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL?.toLowerCase();

export function isAdmin(email: string): boolean {
  return !!ADMIN_EMAIL && email.toLowerCase() === ADMIN_EMAIL;
}

export function parseScopes(scope: string): string[] {
  return scope.split(/\s+/).filter(Boolean);
}

export function buildIdentityClaims(
  user: User,
  scopes: string[],
): Record<string, unknown> {
  const claims: Record<string, unknown> = {};
  if (scopes.includes("email")) {
    claims.email = user.email;
    claims.email_verified = Boolean(user.emailVerifiedAt);
  }
  // What other people may see: for apps that only show who you are (a game, a chat).
  if (scopes.includes("public_profile") || scopes.includes("profile")) {
    if (user.username) claims.preferred_username = user.username;
    if (user.firstName) claims.given_name = user.firstName;
    const picture = avatarUrl(user);
    if (picture) claims.picture = picture;
  }
  // The full OIDC profile: adds the last name and birthday.
  if (scopes.includes("profile")) {
    if (user.lastName) claims.family_name = user.lastName;
    const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
    if (name) claims.name = name;
    if (user.birthday)
      claims.birthdate = user.birthday.toISOString().slice(0, 10);
  }
  return claims;
}

/** Access tokens say so in their header (RFC 9068), so an ID token can't be used as one. */
export const ACCESS_TOKEN_TYP = "at+jwt";

async function sign(
  payload: Record<string, unknown>,
  subject: string,
  audience: string,
  ttlSeconds: number,
  typ = "JWT",
): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: SIGNING_ALG, kid: SIGNING_KID, typ })
    .setIssuer(ISSUER)
    .setSubject(subject)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime(`${ttlSeconds}s`)
    .setJti(crypto.randomUUID())
    .sign(await getPrivateKey());
}

export async function signAccessToken(opts: {
  user: User;
  clientId: string;
  scope: string;
  roles: string[];
}): Promise<string> {
  const scopes = parseScopes(opts.scope);
  const admin = isAdmin(opts.user.email);
  const roles =
    admin && !opts.roles.includes("ADMIN")
      ? [...opts.roles, "ADMIN"]
      : opts.roles;
  return sign(
    {
      ...buildIdentityClaims(opts.user, scopes),
      client_id: opts.clientId,
      scope: opts.scope,
      roles,
      admin,
    },
    opts.user.id,
    opts.clientId,
    ACCESS_TOKEN_TTL,
    ACCESS_TOKEN_TYP,
  );
}

export async function signIdToken(opts: {
  user: User;
  clientId: string;
  scope: string;
  nonce?: string;
  authTime?: number;
}): Promise<string> {
  const payload = buildIdentityClaims(opts.user, parseScopes(opts.scope));
  if (opts.nonce) payload.nonce = opts.nonce;
  if (opts.authTime) payload.auth_time = opts.authTime;
  return sign(payload, opts.user.id, opts.clientId, ID_TOKEN_TTL);
}

export const TTL = { access: ACCESS_TOKEN_TTL, id: ID_TOKEN_TTL };
