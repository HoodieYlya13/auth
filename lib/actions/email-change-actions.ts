"use server";

import { z } from "zod";
import { after } from "next/server";
import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { tryCatch } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";
import { checkEmailRateLimit, checkRateLimit, RateLimitError } from "@/lib/ratelimit";
import { findPasskeysByEmail, finishPasskeyAuthentication, startPasskeyAuthentication } from "@/lib/auth/webauthn";
import {
  consumeEmailChangeCode,
  createEmailChangeCode,
  forgetIdentityVerified,
  isIdentityVerified,
  markIdentityVerified,
} from "@/lib/auth/email-change";
import { sendEmailChangeCode, sendEmailChangedNotice } from "@/lib/auth/email-change-emails";

export interface EmailChangeResult {
  success: boolean;
  error?: string;
}

export interface EmailChangePasskeyBegin extends EmailChangeResult {
  options?: PublicKeyCredentialRequestOptionsJSON;
  flowId?: string;
}

const NOT_SIGNED_IN = { success: false, error: "You are not signed in." };
const TOO_MANY = { success: false, error: "Too many requests. Please try again later." };
const VERIFY_FIRST = { success: false, error: "Confirm it's you first." };
const WRONG_CODE = { success: false, error: "That code is wrong or has expired." };
const EMAIL_TAKEN = { success: false, error: "Another account already uses that email address." };
const emailSchema = z.email().max(254);

/** Ran the rate limits; false when one was hit. */
async function isWithinLimits(...checks: (() => Promise<void>)[]): Promise<boolean> {
  for (const check of checks) {
    const [error] = await tryCatch(check());
    if (error instanceof RateLimitError) return false;
    if (error) throw error;
  }
  return true;
}

/** Step 1, with a passkey: a prompt limited to this account's own passkeys. */
export async function beginEmailChangePasskey(): Promise<EmailChangePasskeyBegin> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  if (!(await isWithinLimits(() => checkRateLimit("auth")))) return TOO_MANY;
  const passkeys = await findPasskeysByEmail(session.user.email);
  if (passkeys.length === 0) return { success: false, error: "This account has no passkey." };
  const [error, started] = await tryCatch(startPasskeyAuthentication(passkeys));
  if (error || !started) return { success: false, error: "Could not start the passkey." };
  return { success: true, ...started };
}

export async function finishEmailChangePasskey(flowId: string, response: AuthenticationResponseJSON): Promise<EmailChangeResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  const [error, userId] = await tryCatch(finishPasskeyAuthentication(flowId, response));
  // Another account's passkey proves nothing about this one.
  if (error || userId !== session.user.id) return { success: false, error: "That passkey didn't confirm it's you." };
  await markIdentityVerified(session.sessionId);
  return { success: true };
}

/** Step 1, without a passkey: a code to the current address. */
export async function sendCurrentEmailCode(locale: string): Promise<EmailChangeResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  const { email } = session.user;
  if (!(await isWithinLimits(() => checkRateLimit("auth"), () => checkEmailRateLimit(email)))) return TOO_MANY;
  const code = await createEmailChangeCode(session.user.id, "current", email);
  await sendEmailChangeCode(email, code, "current", locale);
  return { success: true };
}

export async function verifyCurrentEmailCode(code: string): Promise<EmailChangeResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  if (!(await consumeEmailChangeCode(session.user.id, "current", code))) return WRONG_CODE;
  await markIdentityVerified(session.sessionId);
  return { success: true };
}

/** Step 2: a code to the new address, which must not belong to another account. */
export async function sendNewEmailCode(newEmail: string, locale: string): Promise<EmailChangeResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  if (!(await isIdentityVerified(session.sessionId))) return VERIFY_FIRST;

  const parsed = emailSchema.safeParse(newEmail?.trim().toLowerCase());
  if (!parsed.success) return { success: false, error: "Please enter a valid email address." };
  const email = parsed.data;
  if (email === session.user.email) return { success: false, error: "That's already your email address." };
  if (await isEmailTaken(email)) return EMAIL_TAKEN;
  if (!(await isWithinLimits(() => checkRateLimit("auth"), () => checkEmailRateLimit(email)))) return TOO_MANY;

  const code = await createEmailChangeCode(session.user.id, "new", email);
  await sendEmailChangeCode(email, code, "new", locale);
  return { success: true };
}

/** Step 3: the new address's code; the account moves to it, and the old address is told. */
export async function confirmNewEmail(code: string, locale: string): Promise<EmailChangeResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  if (!(await isIdentityVerified(session.sessionId))) return VERIFY_FIRST;
  const newEmail = await consumeEmailChangeCode(session.user.id, "new", code);
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
  after(() => sendEmailChangedNotice(oldEmail, newEmail, locale).catch((error) => console.error("Email change notice failed:", error)));
  return { success: true };
}

async function isEmailTaken(email: string): Promise<boolean> {
  return (await prisma.user.findUnique({ where: { email }, select: { id: true } })) !== null;
}
