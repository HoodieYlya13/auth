import { NextResponse, type NextRequest } from "next/server";
import { decodeJwt } from "jose";
import { prisma } from "@/lib/db";
import { destroySession } from "@/lib/auth/session";
import { tryCatchSync } from "@/lib/utils";

const DEFAULT_LOCALE = "en";

/** The app asking, from `client_id` or the ID token it was given (only used to narrow, so not verified). */
function requestingClient(params: URLSearchParams): string | null {
  const clientId = params.get("client_id");
  if (clientId) return clientId;
  const hint = params.get("id_token_hint");
  if (!hint) return null;
  const [error, claims] = tryCatchSync(() => decodeJwt(hint));
  if (error || !claims) return null;
  return typeof claims.aud === "string" ? claims.aud : null;
}

export async function GET(req: NextRequest) {
  // Only a top-level navigation signs out: an <img> or fetch() planted on
  // another site can't (logout CSRF). Browsers without the header still can.
  const dest = req.headers.get("sec-fetch-dest");
  if (!dest || dest === "document") await destroySession();

  const params = req.nextUrl.searchParams;
  const postLogout = params.get("post_logout_redirect_uri");
  const state = params.get("state");

  if (postLogout) {
    // When the app says who it is, only its own URIs are accepted.
    const clientId = requestingClient(params);
    const allowed = await prisma.client.findFirst({
      where: {
        postLogoutRedirectUris: { has: postLogout },
        ...(clientId ? { clientId } : {}),
      },
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
