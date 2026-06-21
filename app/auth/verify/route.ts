import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { createSession } from "@/lib/auth/session";
import { consumeMagicLinkToken } from "@/lib/auth/magic-link";

const DEFAULT_LOCALE = "en";

function safeReturnTo(returnTo: string | undefined): string | null {
  return returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")
    ? returnTo
    : null;
}

export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const token = req.nextUrl.searchParams.get("token");

  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}?error=${reason}`, base));

  if (!token) return fail("invalid_link");

  const payload = await consumeMagicLinkToken(token);
  if (!payload) return fail("expired_link");

  const user = await prisma.user.upsert({
    where: { email: payload.email },
    update: { emailVerifiedAt: new Date() },
    create: { email: payload.email, emailVerifiedAt: new Date() },
  });

  await createSession(user.id, req.headers.get("user-agent") ?? undefined);

  const locale = payload.locale ?? DEFAULT_LOCALE;
  const returnTo = safeReturnTo(payload.returnTo);

  if (!user.username) {
    const reg = new URL(`/${locale}/auth/complete-registration`, base);
    if (returnTo) reg.searchParams.set("return_to", returnTo);
    return NextResponse.redirect(reg);
  }

  return NextResponse.redirect(new URL(returnTo ?? `/${locale}/account`, base));
}
