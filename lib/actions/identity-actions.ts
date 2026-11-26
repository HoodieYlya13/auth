"use server";

import type { AuthenticationResponseJSON, PublicKeyCredentialRequestOptionsJSON } from "@simplewebauthn/server";
import { tryCatch } from "@/lib/utils";
import { getSession } from "@/lib/auth/session";
import { checkEmailRateLimit, checkRateLimit } from "@/lib/ratelimit";
import { findPasskeysByEmail, finishPasskeyAuthentication, startPasskeyAuthentication } from "@/lib/auth/webauthn";
import { consumeAccountCode, createAccountCode, markIdentityVerified } from "@/lib/auth/account-codes";
import { sendAccountCode } from "@/lib/auth/account-emails";
import { isWithinLimits, NOT_SIGNED_IN, TOO_MANY, WRONG_CODE, type StepResult } from "@/lib/actions/sensitive-action-guards";

export interface IdentityPasskeyBegin extends StepResult {
  options?: PublicKeyCredentialRequestOptionsJSON;
  flowId?: string;
}

/** Confirming it's you with a passkey: a prompt limited to this account's own passkeys. */
export async function beginIdentityPasskey(): Promise<IdentityPasskeyBegin> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  if (!(await isWithinLimits(() => checkRateLimit("auth")))) return TOO_MANY;
  const passkeys = await findPasskeysByEmail(session.user.email);
  if (passkeys.length === 0) return { success: false, error: "This account has no passkey." };
  const [error, started] = await tryCatch(startPasskeyAuthentication(passkeys));
  if (error || !started) return { success: false, error: "Could not start the passkey." };
  return { success: true, ...started };
}

export async function finishIdentityPasskey(flowId: string, response: AuthenticationResponseJSON): Promise<StepResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  const [error, userId] = await tryCatch(finishPasskeyAuthentication(flowId, response));
  // Another account's passkey proves nothing about this one.
  if (error || userId !== session.user.id) return { success: false, error: "That passkey didn't confirm it's you." };
  await markIdentityVerified(session.sessionId);
  return { success: true };
}

/** Confirming it's you without a passkey: a code to the account's address. */
export async function sendIdentityCode(locale: string): Promise<StepResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  const { email } = session.user;
  if (!(await isWithinLimits(() => checkRateLimit("auth"), () => checkEmailRateLimit(email)))) return TOO_MANY;
  const code = await createAccountCode(session.user.id, "identity", email);
  await sendAccountCode(email, code, "identity", locale);
  return { success: true };
}

export async function verifyIdentityCode(code: string): Promise<StepResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  if (!(await consumeAccountCode(session.user.id, "identity", code))) return WRONG_CODE;
  await markIdentityVerified(session.sessionId);
  return { success: true };
}
