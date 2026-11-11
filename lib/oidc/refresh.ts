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
  | {
      ok: true;
      userId: string;
      clientDbId: string;
      scope: string;
      token: string;
      sessionId: string | null;
    }
  | { ok: false };

export async function rotateRefreshToken(
  presented: string,
): Promise<RotateResult> {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: sha256Base64Url(presented) },
  });
  if (!record) return { ok: false };

  const successor = async (): Promise<RotateResult> => ({
    ok: true,
    userId: record.userId,
    clientDbId: record.clientId,
    scope: record.scope,
    sessionId: record.sessionId,
    token: await issueRefreshToken({
      userId: record.userId,
      clientDbId: record.clientId,
      scope: record.scope,
      familyId: record.familyId,
      sessionId: record.sessionId,
    }),
  });

  // Rotated moments ago: a second tab or request refreshing at the same time,
  // not a stolen token. It gets a token of the same family too: refused, the
  // client would sign the user out, overwriting the winner's fresh token.
  const racing = (usedAt: Date | null) =>
    !!usedAt && Date.now() - usedAt.getTime() < REUSE_GRACE_MS;

  if (record.revoked || record.expiresAt < new Date()) return { ok: false };
  if (racing(record.usedAt)) return successor();
  if (record.usedAt) {
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
  // Lost the race by a hair: the same grace as above.
  if (claimed.count !== 1) {
    const now = await prisma.refreshToken.findUnique({ where: { id: record.id } });
    return now && !now.revoked && racing(now.usedAt) ? successor() : { ok: false };
  }
  return successor();
}
