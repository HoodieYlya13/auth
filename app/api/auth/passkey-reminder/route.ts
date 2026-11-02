import { NextResponse, type NextRequest } from "next/server";
import { forgetStaleSessionCookie, getSession } from "@/lib/auth/session";
import {
  markPasskeyReminder,
  passkeyPromptDue,
  passkeyPromptPath,
} from "@/lib/auth/passkey-prompt";
import { hasLocale } from "@/lib/dictionaries/dictionaries";
import { safeReturnTo } from "@/lib/redirect";

const DEFAULT_LOCALE = "en";

/**
 * The daily passkey check, for pages: proxy.ts sends signed-in visits here
 * when the reminder cookie is missing. Offers a passkey (then back to the
 * page) or goes straight back; either way the cookie is set, so the next
 * visit isn't sent here again today.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lang = p.get("lang");
  const locale = lang && hasLocale(lang) ? lang : DEFAULT_LOCALE;
  const returnTo = safeReturnTo(p.get("return_to")) ?? `/${locale}/account`;
  const back = (path: string) => NextResponse.redirect(new URL(path, req.nextUrl.origin));

  const session = await getSession();
  if (!session) {
    // Expired or revoked: without the cookie, the page asks to sign in (and
    // proxy.ts doesn't send it back here).
    await forgetStaleSessionCookie();
    return back(returnTo);
  }
  // No username yet: the page sends them to finish registering, which offers
  // a passkey right after.
  if (!session.user.username) {
    await markPasskeyReminder();
    return back(returnTo);
  }
  if (await passkeyPromptDue(session.user.id))
    return back(passkeyPromptPath(locale, returnTo));
  return back(returnTo);
}
