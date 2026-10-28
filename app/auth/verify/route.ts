import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import {
  consumeMagicLinkToken,
  peekMagicLinkToken,
} from "@/lib/auth/magic-link";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { safeReturnTo } from "@/lib/redirect";

const DEFAULT_LOCALE = "en";
const TOKEN_FORMAT = /^[A-Za-z0-9_-]{20,100}$/;

function fail(req: NextRequest, reason: string) {
  return NextResponse.redirect(
    new URL(`/${DEFAULT_LOCALE}?error=${reason}`, req.nextUrl.origin),
    303,
  );
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Opening the link only asks for a click; the sign-in happens on POST. Mail
 * scanners that fetch every link (Outlook, Defender…) would otherwise use the
 * one-time token before the person does, and the click is a last chance to
 * notice a link they never asked for.
 */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token || !TOKEN_FORMAT.test(token)) return fail(req, "invalid_link");
  const payload = await peekMagicLinkToken(token);
  if (!payload) return fail(req, "expired_link");

  const locale = payload.locale && hasLocale(payload.locale) ? payload.locale : DEFAULT_LOCALE;
  const t = (await getDictionary(locale)).verify;
  const html = `<!doctype html>
<html lang="${locale}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(t.title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #fafafa; color: #0a0a0a; }
  @media (prefers-color-scheme: dark) { body { background: #0a0a0a; color: #fafafa; } }
  main { text-align: center; padding: 2rem; max-width: 22rem; }
  h1 { font-size: 1.125rem; margin: 0 0 0.5rem; }
  p { font-size: 0.875rem; opacity: 0.7; margin: 0 0 1.25rem; line-height: 1.5; word-break: break-word; }
  button { font: inherit; font-size: 0.875rem; font-weight: 600; cursor: pointer;
    padding: 0.5rem 1.25rem; border-radius: 0.6rem; border: 1px solid currentColor; background: none; color: inherit; }
</style>
</head>
<body>
  <main>
    <h1>${escapeHtml(t.title)}</h1>
    <p>${escapeHtml(t.message.replace("{email}", payload.email))}</p>
    <form method="post" action="/auth/verify">
      <input type="hidden" name="token" value="${token}" />
      <button type="submit">${escapeHtml(t.button)}</button>
    </form>
  </main>
</body>
</html>`;
  return new NextResponse(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
    },
  });
}

export async function POST(req: NextRequest) {
  const token = (await req.formData()).get("token");
  if (typeof token !== "string" || !TOKEN_FORMAT.test(token))
    return fail(req, "invalid_link");

  const payload = await consumeMagicLinkToken(token);
  if (!payload) return fail(req, "expired_link");

  const user = await prisma.user.upsert({
    where: { email: payload.email },
    update: { emailVerifiedAt: new Date() },
    create: { email: payload.email, emailVerifiedAt: new Date() },
  });

  await createSession(user.id, req.headers.get("user-agent") ?? undefined);

  const locale = payload.locale && hasLocale(payload.locale) ? payload.locale : DEFAULT_LOCALE;
  const returnTo = safeReturnTo(payload.returnTo);
  const base = req.nextUrl.origin;

  // 303: the browser follows with a GET.
  if (!user.username) {
    const reg = new URL(`/${locale}/auth/complete-registration`, base);
    if (returnTo) reg.searchParams.set("return_to", returnTo);
    return NextResponse.redirect(reg, 303);
  }

  return NextResponse.redirect(new URL(returnTo ?? `/${locale}/account`, base), 303);
}
