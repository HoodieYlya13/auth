import "server-only";
import { prisma } from "@/lib/db";
import { consentCovers } from "@/lib/oidc/clients";
import type { Prompt } from "@/lib/oidc/prompt";
import type { AppMembership, Client } from "@/lib/generated/prisma/client";

export function findAppLink(userId: string, clientDbId: string) {
  return prisma.appMembership.findUnique({
    where: { userId_clientId: { userId, clientId: clientDbId } },
  });
}

/** Links the app to the user, adding these scopes to any agreed before. */
export async function linkApp(
  userId: string,
  client: Client,
  scopes: string[],
): Promise<void> {
  const link = await findAppLink(userId, client.id);
  await prisma.appMembership.upsert({
    where: { userId_clientId: { userId, clientId: client.id } },
    update: {
      scopesGranted: [...new Set([...(link?.scopesGranted ?? []), ...scopes])],
    },
    create: {
      userId,
      clientId: client.id,
      roles: client.defaultRoles.length ? client.defaultRoles : ["USER"],
      scopesGranted: scopes,
    },
  });
}

export interface ConfirmationContext {
  client: Client;
  link: AppMembership | null;
  scopes: string[];
  prompts: Set<Prompt>;
  hasJustSignedIn: boolean;
}

/** Whether the user must confirm the account (trusted apps) or consent (others) before going on. */
export function needsConfirmation({
  client,
  link,
  scopes,
  prompts,
  hasJustSignedIn,
}: ConfirmationContext): boolean {
  if (prompts.has("consent")) return true;
  if (prompts.has("select_account") && !hasJustSignedIn) return true;
  if (!link) return !client.trusted || !hasJustSignedIn;
  return !client.trusted && !consentCovers(link.scopesGranted, scopes);
}
