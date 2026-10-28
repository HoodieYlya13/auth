"use server";

import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import {
  getClient,
  grantableScopes,
  isValidRedirectUri,
} from "@/lib/oidc/clients";
import { parseAuthorizeReturnTo } from "@/lib/oidc/authorize-params";

export interface ConsentResult {
  success: boolean;
  redirectTo?: string;
  error?: string;
}

export async function approveConsent(returnTo: string): Promise<ConsentResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "You are not signed in." };

  const parsed = parseAuthorizeReturnTo(returnTo);
  if (!parsed) return { success: false, error: "Invalid authorization request." };

  const client = await getClient(parsed.clientId);
  if (!client || !isValidRedirectUri(client, parsed.redirectUri))
    return { success: false, error: "Unknown application." };

  const granted = grantableScopes(client, parsed.scope);
  const membership = await prisma.appMembership.findUnique({
    where: { userId_clientId: { userId: user.id, clientId: client.id } },
    select: { scopesGranted: true },
  });
  await prisma.appMembership.upsert({
    where: { userId_clientId: { userId: user.id, clientId: client.id } },
    // Adds to what was agreed before rather than replacing it.
    update: {
      scopesGranted: [...new Set([...(membership?.scopesGranted ?? []), ...granted])],
    },
    create: {
      userId: user.id,
      clientId: client.id,
      roles: client.defaultRoles.length ? client.defaultRoles : ["USER"],
      scopesGranted: granted,
    },
  });

  return { success: true, redirectTo: parsed.path };
}

export async function denyConsent(returnTo: string): Promise<ConsentResult> {
  const parsed = parseAuthorizeReturnTo(returnTo);
  if (!parsed) return { success: false, error: "Invalid authorization request." };
  // Only back to a URI the app registered: otherwise "Cancel" could send anyone anywhere.
  const client = await getClient(parsed.clientId);
  if (!client || !isValidRedirectUri(client, parsed.redirectUri))
    return { success: false, error: "Invalid authorization request." };

  const url = new URL(parsed.redirectUri);
  url.searchParams.set("error", "access_denied");
  if (parsed.state) url.searchParams.set("state", parsed.state);
  return { success: true, redirectTo: url.toString() };
}
