import { NextResponse, type NextRequest } from "next/server";
import { safeReturnTo } from "@/lib/redirect";

const LOCALES = ["en", "fr"];
const DEFAULT_LOCALE = "en";

const PROTECTED = [
  "/account",
  "/admin",
  "/consent",
  "/auth/complete-registration",
];

const SESSION_COOKIE = "auth_session";

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
    if (rest === "/" && req.cookies.has(SESSION_COOKIE)) {
      const safe = safeReturnTo(req.nextUrl.searchParams.get("return_to"));
      return NextResponse.redirect(
        new URL(safe ?? `/${locale}/account`, req.nextUrl.origin),
      );
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

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|.well-known|favicon.ico).*)"],
};
