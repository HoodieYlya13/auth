import { NextResponse, type NextRequest } from "next/server";
import { forgetStaleSessionCookie, getSession } from "@/lib/auth/session";
import { hasLocale } from "@/lib/dictionaries/dictionaries";
import { safeReturnTo } from "@/lib/redirect";

const DEFAULT_LOCALE = "en";

/**
 * The sign-in page with a session cookie: proxy.ts sends it here, since only
 * the database knows whether that session still exists. Still signed in: on
 * to where they were headed. Expired or revoked (signed out from another
 * device, the account deleted…): the cookie is dropped and the sign-in page
 * shows. Without this, the page and /api/oidc/authorize sent each other the
 * browser forever ("too many redirects").
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const lang = p.get("lang");
  const locale = lang && hasLocale(lang) ? lang : DEFAULT_LOCALE;
  const returnTo = safeReturnTo(p.get("return_to"));

  if (await getSession())
    return NextResponse.redirect(new URL(returnTo ?? `/${locale}/account`, req.nextUrl.origin));

  await forgetStaleSessionCookie();
  const login = new URL(`/${locale}`, req.nextUrl.origin);
  if (returnTo) login.searchParams.set("return_to", returnTo);
  return NextResponse.redirect(login);
}
