import "server-only";
import { randomInt } from "node:crypto";
import { getRedis } from "@/lib/redis";
import { safeEqual, sha256Base64Url } from "@/lib/crypto";

const CODE_TTL_SECONDS = 15 * 60;
/** Proving it's you opens a sensitive change (email, deletion) for this long, on this sign-in only. */
const VERIFIED_TTL_SECONDS = 10 * 60;
const CODE_MAX_TRIES = 5;

/** What a code proves: that it's you (sent to your address), or that a new address is yours. */
export type AccountCodePurpose = "identity" | "new-email";

interface StoredCode {
  purpose: AccountCodePurpose;
  email: string;
  /** sha256 of the code: a leaked Redis dump doesn't hand out account changes. */
  codeHash: string;
}

const codeKey = (userId: string) => `acct:code:${userId}`;
const triesKey = (userId: string) => `acct:tries:${userId}`;
const verifiedKey = (sessionId: string) => `acct:verified:${sessionId}`;

/** A new 6-digit code for this purpose, replacing any earlier one. */
export async function createAccountCode(userId: string, purpose: AccountCodePurpose, email: string): Promise<string> {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const redis = getRedis();
  await Promise.all([
    redis.set(codeKey(userId), { purpose, email, codeHash: sha256Base64Url(code) } satisfies StoredCode, { ex: CODE_TTL_SECONDS }),
    redis.del(triesKey(userId)),
  ]);
  return code;
}

/** The address the code was sent to when it's right for this purpose; single use, and five wrong tries end it. */
export async function consumeAccountCode(userId: string, purpose: AccountCodePurpose, code: string): Promise<string | null> {
  const redis = getRedis();
  const saved = await redis.get<StoredCode>(codeKey(userId));
  if (!saved || saved.purpose !== purpose) return null;
  if (!safeEqual(sha256Base64Url(code), saved.codeHash)) {
    const tries = await redis.incr(triesKey(userId));
    if (tries === 1) await redis.expire(triesKey(userId), CODE_TTL_SECONDS);
    if (tries >= CODE_MAX_TRIES) await redis.del(codeKey(userId), triesKey(userId));
    return null;
  }
  // Only one of two simultaneous right answers gets it.
  if (!(await redis.del(codeKey(userId)))) return null;
  await redis.del(triesKey(userId));
  return saved.email;
}

export async function markIdentityVerified(sessionId: string): Promise<void> {
  await getRedis().set(verifiedKey(sessionId), "1", { ex: VERIFIED_TTL_SECONDS });
}

export async function isIdentityVerified(sessionId: string): Promise<boolean> {
  return (await getRedis().get(verifiedKey(sessionId))) !== null;
}

export async function forgetIdentityVerified(sessionId: string): Promise<void> {
  await getRedis().del(verifiedKey(sessionId));
}
