import { type NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { prisma } from "@/lib/db";
import { getPublicKey } from "@/lib/oidc/keys";
import { buildIdentityClaims, parseScopes } from "@/lib/oidc/tokens";

const ISSUER = process.env.ISSUER ?? "";

function unauthorized() {
  return new NextResponse(null, {
    status: 401,
    headers: { "WWW-Authenticate": "Bearer" },
  });
}

async function handle(req: NextRequest) {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return unauthorized();

  let scope = "openid";
  let sub: string | undefined;
  try {
    const { payload } = await jwtVerify(token, await getPublicKey(), {
      issuer: ISSUER,
    });
    sub = payload.sub;
    if (typeof payload.scope === "string") scope = payload.scope;
  } catch {
    return unauthorized();
  }
  if (!sub) return unauthorized();

  const user = await prisma.user.findUnique({ where: { id: sub } });
  if (!user) return unauthorized();

  return NextResponse.json(
    { sub: user.id, ...buildIdentityClaims(user, parseScopes(scope)) },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export const GET = handle;
export const POST = handle;
