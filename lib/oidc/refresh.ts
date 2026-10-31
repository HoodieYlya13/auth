import "server-only";
import { prisma } from "@/lib/db";
import { randomToken, sha256Base64Url } from "@/lib/crypto";

const TTL = Number(process.env.REFRESH_TOKEN_TTL ?? 2592000); // 30 days
/** Reuse this soon after rotation is treated as a race, not theft. */
const REUSE_GRACE_MS = 10_000;

export async function issueRefreshToken(opts: {
  userId: string;
  clientDbId: string;
  scope: string;
  familyId?: string;
  /** The sign-in that granted it; signing out there revokes it. */
  sessionId?: string | null;
}): Promise<string> {
  const token = randomToken(32);
  await prisma.refreshToken.create({
    data: {
      familyId: opts.familyId ?? crypto.randomUUID(),
      tokenHash: sha256Base64Url(token),
      userId: opts.userId,
      clientId: opts.clientDbId,
      scope: opts.scope,
      sessionId: opts.sessionId ?? null,
      expiresAt: new Date(Date.now() + TTL * 1000),
    },
  });
  return token;
}

export type RotateResult =
  | { ok: true; userId: string; clientDbId: string; scope: string; token: string }
  | { ok: false };

export async function rotateRefreshToken(
  presented: string,
): Promise<RotateResult> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256Base64Url(presented) },
  });
  if (!record) return { ok: false };

  // Rotated moments ago: a second tab or a retry refreshing at the same time,
  // not a stolen token. Refused, but the family stays valid.
  if (
    record.usedAt &&
    !record.revoked &&
    Date.now() - record.usedAt.getTime() < REUSE_GRACE_MS
  )
    return { ok: false };

  if (record.revoked || record.usedAt || record.expiresAt < new Date()) {
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId },
      data: { revoked: true },
    });
    return { ok: false };
  }

  // Claimed atomically: of two requests racing with the same token, only one rotates it.
  const claimed = await prisma.refreshToken.updateMany({
    where: { id: record.id, usedAt: null, revoked: false },
    data: { usedAt: new Date() },
  });
  if (claimed.count !== 1) return { ok: false };

  const token = await issueRefreshToken({
    userId: record.userId,
    clientDbId: record.clientId,
    scope: record.scope,
    familyId: record.familyId,
    sessionId: record.sessionId,
  });

  return {
    ok: true,
    userId: record.userId,
    clientDbId: record.clientId,
    scope: record.scope,
    token,
  };
}
