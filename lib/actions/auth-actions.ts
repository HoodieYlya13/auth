"use server";

import {
  checkRateLimit,
  isRepeatSubmission,
  RateLimitError,
} from "@/lib/ratelimit";
import { isCaptchaEnabled, verifyTurnstileToken } from "@/lib/turnstile";
import { tryCatch } from "@/lib/utils";

const MIN_HUMAN_FILL_MS = 100;

interface AuthData {
  email: string;
  elapsedMs?: number;
  captchaToken?: string;
}

export interface AuthActionResult {
  success: boolean;
  requiresCaptcha?: boolean;
  error?: string;
}

async function enforceRateLimit(): Promise<AuthActionResult | null> {
  const [error] = await tryCatch(checkRateLimit("auth"));
  if (error) {
    if (error instanceof RateLimitError) {
      return {
        success: false,
        error: "Too many requests. Please try again later.",
      };
    }
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

  if (!data.captchaToken) {
    return {
      success: false,
      requiresCaptcha: true,
      error: "Please complete the verification to continue.",
    };
  }

  const [verifyError, valid] = await tryCatch(
    verifyTurnstileToken(data.captchaToken),
  );

  if (verifyError || !valid) {
    return {
      success: false,
      requiresCaptcha: true,
      error: "Verification failed. Please try again.",
    };
  }

  return null;
}

export async function authenticatePasskey(): Promise<AuthActionResult> {
  const rateLimitResult = await enforceRateLimit();
  if (rateLimitResult) return rateLimitResult;

  console.log("Server action: authenticatePasskey");
  return { success: true };
}

export async function authenticateMagicLink(
  data: AuthData,
): Promise<AuthActionResult> {
  const rateLimitResult = await enforceRateLimit();
  if (rateLimitResult) return rateLimitResult;

  const captchaResult = await enforceCaptcha(data);
  if (captchaResult) return captchaResult;

  console.log("Server action: authenticateMagicLink for email:", data.email);
  return { success: true };
}
