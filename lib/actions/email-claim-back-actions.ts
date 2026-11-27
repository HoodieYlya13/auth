"use server";

import { after } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { tryCatch } from "@/lib/utils";
import { signOutEverywhere } from "@/lib/auth/session";
import { cancelDeletion } from "@/lib/auth/account-deletion";
import { consumeClaimBack, type ClaimBack } from "@/lib/auth/email-claim-back";
import { sendEmailClaimedBackNotice } from "@/lib/auth/account-emails";
import type { StepResult } from "@/lib/actions/sensitive-action-guards";

const LINK_GONE: StepResult = { success: false, error: "This link has expired or was already used." };
const FORMER_EMAIL_TAKEN: StepResult = { success: false, error: "Another account now uses your former address." };

/**
 * The former address takes the account back: the email returns to it, every sign-in and app token ends,
 * and the passkeys go, since whoever changed the email may have added theirs.
 */
export async function claimAccountBack(token: string, locale: string): Promise<StepResult> {
  const claimBack = await consumeClaimBack(token);
  if (!claimBack) return LINK_GONE;
  const user = await prisma.user.findUnique({ where: { id: claimBack.userId }, select: { email: true } });
  if (!user) return LINK_GONE;

  const [error] = await tryCatch(restoreFormerEmail(claimBack));
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return FORMER_EMAIL_TAKEN;
  if (error) throw error;
  await signOutEverywhere(claimBack.userId);
  await revokeEveryAppToken(claimBack.userId);
  await cancelDeletion(claimBack.userId);
  after(() => sendEmailClaimedBackNotice(user.email, locale).catch((error) => console.error("Claim back notice failed:", error)));
  return { success: true };
}

async function restoreFormerEmail({ userId, formerEmail }: ClaimBack): Promise<void> {
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { email: formerEmail, emailVerifiedAt: new Date() } }),
    prisma.credential.deleteMany({ where: { userId } }),
  ]);
}

/** Tokens not tied to a sign-in survive signing out everywhere. */
async function revokeEveryAppToken(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({ where: { userId, revoked: false }, data: { revoked: true } });
}
