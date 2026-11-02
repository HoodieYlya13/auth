import "server-only";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import type { MagicLinkPayload } from "@/lib/auth/magic-link";
import { hasLocale } from "@/lib/dictionaries/dictionaries";
import { safeReturnTo } from "@/lib/redirect";
import { passkeyPromptDue, passkeyPromptPath } from "@/lib/auth/passkey-prompt";

const DEFAULT_LOCALE = "en";

/**
 * Signs in the owner of a used link or code, and says where they go next:
 * registration, the daily passkey offer, or where they were headed.
 */
export async function finishMagicSignIn(
  payload: MagicLinkPayload,
  userAgent: string | undefined,
): Promise<string> {
  const user = await prisma.user.upsert({
    where: { email: payload.email },
    update: { emailVerifiedAt: new Date() },
    create: { email: payload.email, emailVerifiedAt: new Date() },
  });

  await createSession(user.id, userAgent);

  const locale = payload.locale && hasLocale(payload.locale) ? payload.locale : DEFAULT_LOCALE;
  const returnTo = safeReturnTo(payload.returnTo);

  if (!user.username) {
    return returnTo
      ? `/${locale}/auth/complete-registration?return_to=${encodeURIComponent(returnTo)}`
      : `/${locale}/auth/complete-registration`;
  }

  // Signed in by email again: offer a passkey instead, once a day.
  // Not when already headed for the passkey page (an app sent them there).
  const toPrompt = returnTo?.split("?")[0] === `/${locale}/auth/passkey`;
  if (!toPrompt && (await passkeyPromptDue(user.id))) return passkeyPromptPath(locale, returnTo);

  return returnTo ?? `/${locale}/account`;
}
