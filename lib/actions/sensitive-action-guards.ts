import "server-only";
import { tryCatch } from "@/lib/utils";
import { RateLimitError } from "@/lib/ratelimit";

/** What the account's sensitive actions answer: done, or why not. */
export interface StepResult {
  success: boolean;
  error?: string;
}

export const NOT_SIGNED_IN: StepResult = { success: false, error: "You are not signed in." };
export const TOO_MANY: StepResult = { success: false, error: "Too many requests. Please try again later." };
export const CONFIRM_FIRST: StepResult = { success: false, error: "Confirm it's you first." };
export const WRONG_CODE: StepResult = { success: false, error: "That code is wrong or has expired." };

/** Runs the rate limits in order; false as soon as one is hit. */
export async function isWithinLimits(...checks: (() => Promise<void>)[]): Promise<boolean> {
  for (const check of checks) {
    const [error] = await tryCatch(check());
    if (error instanceof RateLimitError) return false;
    if (error) throw error;
  }
  return true;
}
