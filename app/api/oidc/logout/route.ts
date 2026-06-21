import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { destroySession } from "@/lib/auth/session";

const DEFAULT_LOCALE = "en";

export async function GET(req: NextRequest) {
  await destroySession();

  const postLogout = req.nextUrl.searchParams.get("post_logout_redirect_uri");
  const state = req.nextUrl.searchParams.get("state");

  if (postLogout) {
    const allowed = await prisma.client.findFirst({
      where: { postLogoutRedirectUris: { has: postLogout } },
      select: { id: true },
    });
    if (allowed) {
      const url = new URL(postLogout);
      if (state) url.searchParams.set("state", state);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.redirect(new URL(`/${DEFAULT_LOCALE}`, req.nextUrl.origin));
}
