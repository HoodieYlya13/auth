import "server-only";
import { prisma } from "@/lib/db";
import { safeEqual, sha256Base64Url } from "@/lib/crypto";
import { SUPPORTED_SCOPES } from "@/lib/oidc/discovery";
import type { Client } from "@/lib/generated/prisma/client";

export function getClient(clientId: string): Promise<Client | null> {
  return prisma.client.findUnique({ where: { clientId } });
}

export function isValidRedirectUri(client: Client, uri: string): boolean {
  return client.redirectUris.includes(uri);
}

export function verifyClientSecret(client: Client, secret?: string): boolean {
  if (!client.clientSecretHash) return true;
  if (!secret) return false;
  return safeEqual(sha256Base64Url(secret), client.clientSecretHash);
}

/** The requested scopes this server supports and the client is allowed to ask for. */
export function grantableScopes(client: Client, scope: string): string[] {
  return scope
    .split(/\s+/)
    .filter(Boolean)
    .filter(
      (s, i, all) =>
        all.indexOf(s) === i &&
        SUPPORTED_SCOPES.includes(s) &&
        (client.allowedScopes.length === 0 || client.allowedScopes.includes(s)),
    );
}

/** Whether what the user agreed to earlier covers these scopes (an app asking for more asks again). */
export function consentCovers(granted: string[], scopes: string[]): boolean {
  return scopes.every((s) => granted.includes(s));
}

/** Schemes a browser would run as code (or read locally) instead of navigating to an app. */
const UNSAFE_SCHEMES = ["javascript:", "data:", "vbscript:", "file:", "blob:"];

/**
 * Why a redirect URI can't be registered, or null when it can. It must be an
 * absolute URL without a fragment (OAuth 2.0 §3.1.2); custom schemes are fine
 * for native apps, but not ones that run code.
 */
export function redirectUriProblem(uri: string): string | null {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return `"${uri}" is not an absolute URL.`;
  }
  if (UNSAFE_SCHEMES.includes(url.protocol))
    return `"${uri}" uses a scheme that isn't allowed.`;
  if (url.hash || uri.includes("#"))
    return `"${uri}" must not contain a fragment (#).`;
  return null;
}

/**
 * Why a home URL can't be registered, or null when it can. It is shown as a
 * link on the account page, so it must be a web URL (https, or http on
 * localhost) on the same origin as one of the app's redirect URIs.
 */
export function homeUrlProblem(
  uri: string,
  redirectUris: string[],
): string | null {
  let url: URL;
  try {
    url = new URL(uri);
  } catch {
    return `"${uri}" is not an absolute URL.`;
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local))
    return `"${uri}" must use https.`;
  const origins = redirectUris.flatMap((r) => {
    try {
      return [new URL(r).origin];
    } catch {
      return [];
    }
  });
  if (!origins.includes(url.origin))
    return `"${uri}" must be on the same origin as a redirect URI.`;
  return null;
}

export interface ReturnApp {
  name: string;
  homeUrl: string;
  /** The app's post-logout URI on the homeUrl's origin, if it registered one. */
  logoutUrl: string | null;
}

/**
 * The app a user opened their account from (?client_id=), when it has a
 * homeUrl and the user has linked it; null otherwise. Every URL comes from
 * the client record, never from the request.
 */
export async function findReturnApp(
  clientId: string | undefined,
  userId: string,
): Promise<ReturnApp | null> {
  if (!clientId) return null;
  const client = await prisma.client.findFirst({
    where: {
      clientId,
      homeUrl: { not: null },
      memberships: { some: { userId } },
    },
    select: { name: true, homeUrl: true, postLogoutRedirectUris: true },
  });
  if (!client?.homeUrl) return null;

  const origin = new URL(client.homeUrl).origin;
  const logoutUrl =
    client.postLogoutRedirectUris.find((uri) => {
      try {
        return new URL(uri).origin === origin;
      } catch {
        return false;
      }
    }) ?? null;
  return { name: client.name, homeUrl: client.homeUrl, logoutUrl };
}
