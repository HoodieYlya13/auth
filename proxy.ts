import { NextResponse, type NextRequest } from "next/server";
import { safeReturnTo } from "@/lib/redirect";
import {
  REMINDER_COOKIE,
  reminderCookieOptions,
} from "@/lib/auth/passkey-reminder-cookie";

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
// Pages that offer a passkey themselves, or come before it.
const PASSKEY_PROMPT = "/auth/passkey";
const NO_REMINDER = [PASSKEY_PROMPT, "/auth/complete-registration"];

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const segments = pathname.split("/").filter(Boolean);
  const hasLocalePrefix = LOCALES.includes(segments[0] ?? "");
  const locale = hasLocalePrefix ? segments[0] : DEFAULT_LOCALE;
  const rest = `/${segments.slice(hasLocalePrefix ? 1 : 0).join("/")}`;

  const isProtected = PROTECTED.some(
    (p) => rest === p || rest.startsWith(`${p}/`),
  );
  // Page loads only: the refetch after a sign-in's server action set the cookie must not race its redirect (iOS).
  const isPageLoad =
    req.method === "GET" &&
    !req.headers.has("rsc") &&
    !req.headers.has("next-router-prefetch") &&
    req.headers.get("purpose") !== "prefetch";
  if (!isProtected) {
    // Already signed in, maybe: app/api/auth/signed-in checks the session
    // still exists before skipping the sign-in page (else it drops the cookie).
    const isReauthentication = req.nextUrl.searchParams.get("reauth") === "1";
    if (isPageLoad && rest === "/" && req.cookies.has(SESSION_COOKIE) && !isReauthentication) {
      const url = new URL("/api/auth/signed-in", req.nextUrl.origin);
      url.searchParams.set("lang", locale);
      const safe = safeReturnTo(req.nextUrl.searchParams.get("return_to"));
      if (safe) url.searchParams.set("return_to", safe);
      return traced(req, url);
    }
    return NextResponse.next();
  }

  if (!req.cookies.has(SESSION_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = `/${locale}`;
    url.search = "";
    url.searchParams.set("return_to", pathname + search);
    return traced(req, url);
  }

  // Once a day, the first page loaded checks for a passkey on the way (see
  // app/api/auth/passkey-reminder); a prefetch would use up the day unseen.
  if (
    isPageLoad &&
    !req.cookies.has(REMINDER_COOKIE) &&
    !NO_REMINDER.some((p) => rest === p || rest.startsWith(`${p}/`))
  ) {
    const url = new URL("/api/auth/passkey-reminder", req.nextUrl.origin);
    url.searchParams.set("lang", locale);
    url.searchParams.set("return_to", pathname + search);
    return traced(req, url);
  }

  if (isPageLoad && rest === PASSKEY_PROMPT) return passkeyPromptSeen();
  return NextResponse.next();
}

// Marked here rather than from the page: a cookie set by a server action re-renders it, losing return_to on iOS.
function passkeyPromptSeen(): NextResponse {
  const response = NextResponse.next();
  response.cookies.set(REMINDER_COOKIE, "1", reminderCookieOptions);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.well-known|favicon.ico).*)"],
};

/** Temporary: a page-load redirect and where it leads, paths only (see lib/return-to-debug). */
function traced(req: NextRequest, url: URL): NextResponse {
  const device = /iPhone|iPad/.test(req.headers.get("user-agent") ?? "") ? "iOS" : "other";
  console.warn(`[return-to] proxy ${device} ${req.method} ${req.nextUrl.pathname} -> ${url.pathname} rsc=${req.headers.has("rsc")}`);
  return NextResponse.redirect(url);
}
