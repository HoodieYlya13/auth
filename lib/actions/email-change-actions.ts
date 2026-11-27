"use server";

import { z } from "zod";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { tryCatch } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";
import { checkEmailRateLimit, checkRateLimit } from "@/lib/ratelimit";
import { consumeAccountCode, createAccountCode, forgetIdentityVerified, isIdentityVerified } from "@/lib/auth/account-codes";
import { sendAccountCode, sendEmailChangedNotice } from "@/lib/auth/account-emails";
import { CLAIM_BACK_DAYS, createClaimBack, hasPendingClaimBack } from "@/lib/auth/email-claim-back";
import { CONFIRM_FIRST, isWithinLimits, NOT_SIGNED_IN, TOO_MANY, WRONG_CODE, type StepResult } from "@/lib/actions/sensitive-action-guards";

const EMAIL_TAKEN: StepResult = { success: false, error: "Another account already uses that email address." };
const CHANGED_RECENTLY: StepResult = {
  success: false,
  error: `Your email address changed less than ${CLAIM_BACK_DAYS} days ago. It can change again once that change can no longer be undone.`,
};
const emailSchema = z.email().max(254);

/** Once it's you: a code to the new address, which must not belong to another account. */
export async function sendNewEmailCode(newEmail: string, locale: string): Promise<StepResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  if (!(await isIdentityVerified(session.sessionId))) return CONFIRM_FIRST;
  if (await hasPendingClaimBack(session.user.id)) return CHANGED_RECENTLY;

  const parsed = emailSchema.safeParse(newEmail?.trim().toLowerCase());
  if (!parsed.success) return { success: false, error: "Please enter a valid email address." };
  const email = parsed.data;
  if (email === session.user.email) return { success: false, error: "That's already your email address." };
  if (await isEmailTaken(email)) return EMAIL_TAKEN;
  if (!(await isWithinLimits(() => checkRateLimit("auth"), () => checkEmailRateLimit(email)))) return TOO_MANY;

  const code = await createAccountCode(session.user.id, "new-email", email);
  await sendAccountCode(email, code, "new-email", locale);
  return { success: true };
}

/** The new address's code; the account moves to it, and the old address is told, with a link to take it back. */
export async function confirmNewEmail(code: string, locale: string): Promise<StepResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  if (!(await isIdentityVerified(session.sessionId))) return CONFIRM_FIRST;
  if (await hasPendingClaimBack(session.user.id)) return CHANGED_RECENTLY;
  const newEmail = await consumeAccountCode(session.user.id, "new-email", code);
  if (!newEmail) return WRONG_CODE;
  // Taken meanwhile by a sign-up with that address.
  if (await isEmailTaken(newEmail)) return EMAIL_TAKEN;

  const oldEmail = session.user.email;
  const [error] = await tryCatch(
    prisma.user.update({
      where: { id: session.user.id },
      data: { email: newEmail, emailVerifiedAt: new Date() },
    }),
  );
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return EMAIL_TAKEN;
  if (error) throw error;
  await forgetIdentityVerified(session.sessionId);
  const claimBackToken = await createClaimBack({ userId: session.user.id, formerEmail: oldEmail });
  after(() =>
    sendEmailChangedNotice({ oldEmail, newEmail, claimBackToken }, locale).catch((error) => console.error("Email change notice failed:", error)),
  );
  return { success: true };
}

async function isEmailTaken(email: string): Promise<boolean> {
  return (await prisma.user.findUnique({ where: { email }, select: { id: true } })) !== null;
}
