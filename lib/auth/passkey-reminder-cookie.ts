// No "server-only": proxy.ts uses it too.

export const REMINDER_COOKIE = "passkey_reminder";
const REMINDER_MAX_AGE = 24 * 60 * 60;

export const reminderCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: REMINDER_MAX_AGE,
};
