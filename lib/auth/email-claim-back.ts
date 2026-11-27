import "server-only";
import { getRedis } from "@/lib/redis";
import { randomToken, sha256Base64Url } from "@/lib/crypto";

/** How long the former address can undo an email change; the address can't change again meanwhile. */
export const CLAIM_BACK_DAYS = 7;
const CLAIM_BACK_TTL_SECONDS = CLAIM_BACK_DAYS * 24 * 60 * 60;

export interface ClaimBack {
  userId: string;
  formerEmail: string;
}

/** Stored under the token's sha256: a leaked Redis dump doesn't hand out accounts. */
const claimBackKey = (token: string) => `acct:claim-back:${sha256Base64Url(token)}`;
const pendingKey = (userId: string) => `acct:claim-back-pending:${userId}`;

/** A link token for the former address, to give the account back to it. */
export async function createClaimBack(claimBack: ClaimBack): Promise<string> {
  const token = randomToken();
  const redis = getRedis();
  await Promise.all([
    redis.set(claimBackKey(token), claimBack satisfies ClaimBack, { ex: CLAIM_BACK_TTL_SECONDS }),
    redis.set(pendingKey(claimBack.userId), "1", { ex: CLAIM_BACK_TTL_SECONDS }),
  ]);
  return token;
}

/** What the link would do, without using it: opening the page (or a mail scanner) changes nothing. */
export async function findClaimBack(token: string): Promise<ClaimBack | null> {
  return getRedis().get<ClaimBack>(claimBackKey(token));
}

/** Single use: read and deleted in one step. */
export async function consumeClaimBack(token: string): Promise<ClaimBack | null> {
  const redis = getRedis();
  const claimBack = await redis.getdel<ClaimBack>(claimBackKey(token));
  if (claimBack) await redis.del(pendingKey(claimBack.userId));
  return claimBack;
}

export async function hasPendingClaimBack(userId: string): Promise<boolean> {
  return (await getRedis().get(pendingKey(userId))) !== null;
}
