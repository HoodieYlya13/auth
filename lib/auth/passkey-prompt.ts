import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";

/**
 * New accounts, and anyone signing in by email without a passkey (at most once
 * a day), are offered to add one before going on to where they were headed.
 */

const REMINDER_COOKIE = "passkey_reminder";
const REMINDER_MAX_AGE = 24 * 60 * 60;

export async function hasPasskey(userId: string): Promise<boolean> {
  return (await prisma.credential.count({ where: { userId } })) > 0;
}

export function passkeyPromptPath(locale: string, returnTo?: string): string {
  const path = `/${locale}/auth/passkey`;
  return returnTo ? `${path}?return_to=${encodeURIComponent(returnTo)}` : path;
}

/** Whether the prompt is due: not shown on this browser in the last day. */
export async function passkeyReminderDue(): Promise<boolean> {
  return !(await cookies()).has(REMINDER_COOKIE);
}

/** Starts the day without another prompt. */
export async function markPasskeyReminder(): Promise<void> {
  (await cookies()).set(REMINDER_COOKIE, "1", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REMINDER_MAX_AGE,
  });
}
