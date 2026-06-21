import "server-only";
import { prisma } from "@/lib/db";
import { randomToken, sha256Base64Url } from "@/lib/crypto";

const TTL = Number(process.env.REFRESH_TOKEN_TTL ?? 2592000); // 30 days

export async function issueRefreshToken(opts: {
  userId: string;
  clientDbId: string;
  scope: string;
  familyId?: string;
}): Promise<string> {
  const token = randomToken(32);
  await prisma.refreshToken.create({
    data: {
      familyId: opts.familyId ?? crypto.randomUUID(),
      tokenHash: sha256Base64Url(token),
      userId: opts.userId,
      clientId: opts.clientDbId,
      scope: opts.scope,
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

  if (record.revoked || record.usedAt || record.expiresAt < new Date()) {
    await prisma.refreshToken.updateMany({
      where: { familyId: record.familyId },
      data: { revoked: true },
    });
    return { ok: false };
  }

  await prisma.refreshToken.update({
    where: { id: record.id },
    data: { usedAt: new Date() },
  });

  const token = await issueRefreshToken({
    userId: record.userId,
    clientDbId: record.clientId,
    scope: record.scope,
    familyId: record.familyId,
  });

  return {
    ok: true,
    userId: record.userId,
    clientDbId: record.clientId,
    scope: record.scope,
    token,
  };
}
