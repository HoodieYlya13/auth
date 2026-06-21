import "server-only";
import { prisma } from "@/lib/db";
import { safeEqual, sha256Base64Url } from "@/lib/crypto";
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
