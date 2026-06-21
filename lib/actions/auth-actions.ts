"use server";

import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/server";
import {
  checkRateLimit,
  isRepeatSubmission,
  RateLimitError,
} from "@/lib/ratelimit";
import { isCaptchaEnabled, verifyTurnstileToken } from "@/lib/turnstile";
import { tryCatch } from "@/lib/utils";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import {
  createMagicLinkToken,
  sendMagicLinkEmail,
} from "@/lib/auth/magic-link";
import {
  finishPasskeyAuthentication,
  startPasskeyAuthentication,
} from "@/lib/auth/webauthn";

const MIN_HUMAN_FILL_MS = 100;
const ISSUER = process.env.ISSUER ?? "http://localhost:3000";
const DEFAULT_LOCALE = "en";

interface AuthData {
  email: string;
  elapsedMs?: number;
  captchaToken?: string;
  locale?: string;
  returnTo?: string;
}

export interface AuthActionResult {
  success: boolean;
  requiresCaptcha?: boolean;
  error?: string;
}

function safeReturnTo(returnTo: string | undefined): string | undefined {
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//"))
    return returnTo;
  return undefined;
}

async function enforceRateLimit(): Promise<AuthActionResult | null> {
  const [error] = await tryCatch(checkRateLimit("auth"));
  if (error) {
    if (error instanceof RateLimitError)
      return {
        success: false,
        error: "Too many requests. Please try again later.",
      };
    throw error;
  }
  return null;
}

async function enforceCaptcha(
  data: AuthData,
): Promise<AuthActionResult | null> {
  if (!isCaptchaEnabled()) return null;

  const tooFast =
    data.elapsedMs === undefined || data.elapsedMs < MIN_HUMAN_FILL_MS;
  const [, repeat] = await tryCatch(
    isRepeatSubmission(`magic-link:${data.email}`),
  );

  if (!tooFast && repeat !== true) return null;

  if (!data.captchaToken)
    return {
      success: false,
      requiresCaptcha: true,
      error: "Please complete the verification to continue.",
    };

  const [verifyError, valid] = await tryCatch(
    verifyTurnstileToken(data.captchaToken),
  );

  if (verifyError || !valid)
    return {
      success: false,
      requiresCaptcha: true,
      error: "Verification failed. Please try again.",
    };

  return null;
}

export async function authenticateMagicLink(
  data: AuthData,
): Promise<AuthActionResult> {
  const rateLimitResult = await enforceRateLimit();
  if (rateLimitResult) return rateLimitResult;

  const captchaResult = await enforceCaptcha(data);
  if (captchaResult) return captchaResult;

  const email = data.email.trim().toLowerCase();
  const token = await createMagicLinkToken({
    email,
    locale: data.locale ?? DEFAULT_LOCALE,
    returnTo: safeReturnTo(data.returnTo),
  });
  const link = `${ISSUER}/auth/verify?token=${encodeURIComponent(token)}`;

  const [sendError] = await tryCatch(sendMagicLinkEmail(email, link));
  if (sendError) {
    console.error("Magic link send failed:", sendError);
    return { success: false, error: "Could not send the email. Try again." };
  }

  return { success: true };
}

export interface PasskeyBeginResult {
  success: boolean;
  options?: PublicKeyCredentialRequestOptionsJSON;
  flowId?: string;
  error?: string;
}

export async function beginPasskeyAuthentication(): Promise<PasskeyBeginResult> {
  const rateLimitResult = await enforceRateLimit();
  if (rateLimitResult) return { success: false, error: rateLimitResult.error };

  const [error, result] = await tryCatch(startPasskeyAuthentication());
  if (error || !result) {
    console.error("Passkey begin failed:", error);
    return { success: false, error: "Could not start passkey sign-in." };
  }
  return { success: true, ...result };
}

export interface PasskeyFinishResult {
  success: boolean;
  redirectTo?: string;
  error?: string;
}

export async function finishPasskeyAuthenticationAction(
  flowId: string,
  response: AuthenticationResponseJSON,
  locale: string = DEFAULT_LOCALE,
  returnTo?: string,
): Promise<PasskeyFinishResult> {
  const [error, userId] = await tryCatch(
    finishPasskeyAuthentication(flowId, response),
  );
  if (error || !userId) {
    console.error("Passkey finish failed:", error);
    return { success: false, error: "Passkey sign-in failed." };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "Account not found." };

  await createSession(userId);

  const safe = safeReturnTo(returnTo);
  let redirectTo: string;
  if (!user.username)
    redirectTo = safe
      ? `/${locale}/auth/complete-registration?return_to=${encodeURIComponent(safe)}`
      : `/${locale}/auth/complete-registration`;
  else redirectTo = safe ?? `/${locale}/account`;

  return { success: true, redirectTo };
}
