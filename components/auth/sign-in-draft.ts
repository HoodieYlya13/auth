"use client";

const EMAIL_KEY = "auth:sign-in-email";
const SENT_TO_KEY = "auth:code-sent-to";
/** As long as the emailed code works. */
const CODE_LIFETIME_MS = 15 * 60 * 1000;

/**
 * Where the sign-in form was, kept for this tab: switching the language loads
 * the page again, and the form comes back to the same step instead of empty.
 */
function read(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value) sessionStorage.setItem(key, value);
    else sessionStorage.removeItem(key);
  } catch {}
}

export const savedEmail = () => (typeof window === "undefined" ? "" : (read(EMAIL_KEY) ?? ""));
export const saveEmail = (email: string) => write(EMAIL_KEY, email);

interface SentCode {
  email: string;
  sentAt: number;
  /** The sign-in it was for: a code carries where it leads, so another sign-in mustn't reuse its screen. */
  returnTo: string | null;
}

/** The address a code was sent to, while that code still works, for this same sign-in. */
export function savedCodeRecipient(returnTo: string | undefined): string | null {
  if (typeof window === "undefined") return null;
  const saved = read(SENT_TO_KEY);
  if (!saved) return null;
  try {
    const code = JSON.parse(saved) as SentCode;
    const isSameSignIn = code.returnTo === (returnTo ?? null);
    return isSameSignIn && Date.now() - code.sentAt < CODE_LIFETIME_MS ? code.email : null;
  } catch {
    return null;
  }
}

export const saveCodeRecipient = (email: string | null, returnTo: string | undefined) =>
  write(SENT_TO_KEY, email && JSON.stringify({ email, sentAt: Date.now(), returnTo: returnTo ?? null } satisfies SentCode));

/** Signed in: the next visit starts from an empty form. */
export function forgetSignInDraft() {
  saveEmail("");
  saveCodeRecipient(null, undefined);
}
