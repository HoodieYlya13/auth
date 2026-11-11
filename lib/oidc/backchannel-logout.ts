import "server-only";
import { prisma } from "@/lib/db";
import { signLogoutToken } from "@/lib/oidc/tokens";

const DELIVERY_TIMEOUT_MS = 5_000;

export interface BackChannelClient {
  clientId: string;
  backchannelLogoutUri: string | null;
}

/**
 * The apps a sign-in signed into that asked to hear when it ends: those holding
 * a refresh token from it and a back-channel logout URI. Read it before the
 * session is deleted, which unlinks the tokens.
 */
export function backChannelClientsOf(
  sessionId: string,
): Promise<BackChannelClient[]> {
  return prisma.client.findMany({
    where: {
      backchannelLogoutUri: { not: null },
      refreshTokens: { some: { sessionId } },
    },
    select: { clientId: true, backchannelLogoutUri: true },
  });
}

/** Sends each app a logout token for the ended sign-in; one failing app never blocks the others. */
export async function notifyEndedSession(
  clients: BackChannelClient[],
  ended: { userId: string; sessionId: string },
): Promise<void> {
  await Promise.allSettled(clients.map((client) => deliver(client, ended)));
}

async function deliver(
  client: BackChannelClient,
  ended: { userId: string; sessionId: string },
): Promise<void> {
  if (!client.backchannelLogoutUri) return;
  const logoutToken = await signLogoutToken({ clientId: client.clientId, ...ended });
  const response = await fetch(client.backchannelLogoutUri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ logout_token: logoutToken }),
    redirect: "manual",
    signal: AbortSignal.timeout(DELIVERY_TIMEOUT_MS),
  });
  if (!response.ok) {
    console.warn(
      `Back-channel logout to ${client.clientId} answered ${response.status}.`,
    );
  }
}
