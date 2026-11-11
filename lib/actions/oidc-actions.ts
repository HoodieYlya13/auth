"use server";

import { destroySession, getCurrentUser } from "@/lib/auth/session";
import {
  getClient,
  grantableScopes,
  isValidRedirectUri,
} from "@/lib/oidc/clients";
import {
  parseAuthorizeReturnTo,
  type AuthorizeParams,
} from "@/lib/oidc/authorize-params";
import { linkApp } from "@/lib/oidc/app-link";
import { withoutPrompt } from "@/lib/oidc/prompt";
import type { Client } from "@/lib/generated/prisma/client";

export interface ConsentResult {
  success: boolean;
  redirectTo?: string;
  error?: string;
}

async function resolveAuthorizeRequest(
  returnTo: string,
): Promise<{ parsed: AuthorizeParams; client: Client } | null> {
  const parsed = parseAuthorizeReturnTo(returnTo);
  if (!parsed) return null;
  const client = await getClient(parsed.clientId);
  if (!client || !isValidRedirectUri(client, parsed.redirectUri)) return null;
  return { parsed, client };
}

export async function approveConsent(returnTo: string): Promise<ConsentResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "You are not signed in." };

  const request = await resolveAuthorizeRequest(returnTo);
  if (!request) return { success: false, error: "Invalid authorization request." };

  const { parsed, client } = request;
  await linkApp(user.id, client, grantableScopes(client, parsed.scope));
  return { success: true, redirectTo: withoutPrompt(parsed.path) };
}

/** Signs out, then back to the sign-in page to go on with this request as someone else. */
export async function switchAccount(
  returnTo: string,
  locale: string,
): Promise<ConsentResult> {
  const request = await resolveAuthorizeRequest(returnTo);
  if (!request) return { success: false, error: "Invalid authorization request." };

  await destroySession();
  const signIn = new URLSearchParams({ return_to: withoutPrompt(request.parsed.path) });
  return { success: true, redirectTo: `/${locale}?${signIn}` };
}

export async function denyConsent(returnTo: string): Promise<ConsentResult> {
  // Only back to a URI the app registered: otherwise "Cancel" could send anyone anywhere.
  const request = await resolveAuthorizeRequest(returnTo);
  if (!request) return { success: false, error: "Invalid authorization request." };

  const { parsed } = request;
  const url = new URL(parsed.redirectUri);
  url.searchParams.set("error", "access_denied");
  if (parsed.state) url.searchParams.set("state", parsed.state);
  return { success: true, redirectTo: url.toString() };
}
