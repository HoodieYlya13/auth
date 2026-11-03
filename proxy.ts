import { NextResponse, type NextRequest } from "next/server";
import { safeReturnTo } from "@/lib/redirect";

const LOCALES = ["en", "fr"];
const DEFAULT_LOCALE = "en";

const PROTECTED = [
  "/account",
  "/admin",
  "/consent",
  "/auth/complete-registration",
  "/auth/passkey",
];

const SESSION_COOKIE = "auth_session";
// Set by lib/auth/passkey-prompt.ts once the daily passkey check is done.
const REMINDER_COOKIE = "passkey_reminder";
// Pages that offer a passkey themselves, or come before it.
const NO_REMINDER = ["/auth/passkey", "/auth/complete-registration"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const hasLocalePrefix = LOCALES.includes(segments[0] ?? "");
  const locale = hasLocalePrefix ? segments[0] : DEFAULT_LOCALE;
  const rest = `/${segments.slice(hasLocalePrefix ? 1 : 0).join("/")}`;

  const isProtected = PROTECTED.some(
    (p) => rest === p || rest.startsWith(`${p}/`),
  );
  if (!isProtected) {
    // Already signed in, maybe: app/api/auth/signed-in checks the session
    // still exists before skipping the sign-in page (else it drops the cookie).
    if (rest === "/" && req.cookies.has(SESSION_COOKIE)) {
      const url = new URL("/api/auth/signed-in", req.nextUrl.origin);
      url.searchParams.set("lang", locale);
      const safe = safeReturnTo(req.nextUrl.searchParams.get("return_to"));
      if (safe) url.searchParams.set("return_to", safe);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  if (!req.cookies.has(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}`;
    url.search = "";
    url.searchParams.set("return_to", pathname + search);
    return NextResponse.redirect(url);
  }

  // Once a day, the first page loaded checks for a passkey on the way (see
  // app/api/auth/passkey-reminder). Only for page loads: not server actions
  // (POSTs), nor prefetches and client navigations (a full page load came
  // first, and a prefetch would use up the day unseen).
  const isPageLoad =
    req.method === "GET" &&
    !req.headers.has("rsc") &&
    !req.headers.has("next-router-prefetch") &&
    req.headers.get("purpose") !== "prefetch";
  if (
    isPageLoad &&
    !req.cookies.has(REMINDER_COOKIE) &&
    !NO_REMINDER.some((p) => rest === p || rest.startsWith(`${p}/`))
  ) {
    const url = new URL("/api/auth/passkey-reminder", req.nextUrl.origin);
    url.searchParams.set("lang", locale);
    url.searchParams.set("return_to", pathname + search);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.well-known|favicon.ico).*)"],
};
