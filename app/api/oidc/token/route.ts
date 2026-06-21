import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getClient, verifyClientSecret } from "@/lib/oidc/clients";
import { consumeAuthCode, verifyPkce } from "@/lib/oidc/codes";
import { issueRefreshToken, rotateRefreshToken } from "@/lib/oidc/refresh";
import { resolveRoles } from "@/lib/roles";
import { signAccessToken, signIdToken, TTL } from "@/lib/oidc/tokens";
import type { Client, User } from "@/lib/generated/prisma/client";

function tokenError(error: string, status = 400) {
  return NextResponse.json(
    { error },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

function readClientCredentials(
  req: NextRequest,
  form: FormData,
): { clientId?: string; clientSecret?: string } {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    if (idx !== -1) {
      return {
        clientId: decodeURIComponent(decoded.slice(0, idx)),
        clientSecret: decodeURIComponent(decoded.slice(idx + 1)),
      };
    }
  }
  return {
    clientId: (form.get("client_id") as string) || undefined,
    clientSecret: (form.get("client_secret") as string) || undefined,
  };
}

async function buildTokenResponse(
  user: User,
  client: Client,
  scope: string,
  opts: { nonce?: string; authTime?: number; refreshToken?: string },
) {
  const roles = await resolveRoles(user, client.id);
  const [access_token, id_token] = await Promise.all([
    signAccessToken({ user, clientId: client.clientId, scope, roles }),
    signIdToken({
      user,
      clientId: client.clientId,
      scope,
      nonce: opts.nonce,
      authTime: opts.authTime,
    }),
  ]);

  return NextResponse.json(
    {
      access_token,
      token_type: "Bearer",
      expires_in: TTL.access,
      id_token,
      scope,
      ...(opts.refreshToken ? { refresh_token: opts.refreshToken } : {}),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const grantType = form.get("grant_type");
  const { clientId, clientSecret } = readClientCredentials(req, form);

  if (!clientId) return tokenError("invalid_client", 401);
  const client = await getClient(clientId);
  if (!client) return tokenError("invalid_client", 401);
  if (!verifyClientSecret(client, clientSecret)) {
    return tokenError("invalid_client", 401);
  }

  if (grantType === "authorization_code") {
    const code = form.get("code") as string | null;
    const redirectUri = form.get("redirect_uri") as string | null;
    const codeVerifier = form.get("code_verifier") as string | null;

    if (!code || !redirectUri || !codeVerifier) {
      return tokenError("invalid_request");
    }

    const authCode = await consumeAuthCode(code);
    if (
      !authCode ||
      authCode.clientId !== client.clientId ||
      authCode.redirectUri !== redirectUri ||
      !verifyPkce(codeVerifier, authCode.codeChallenge)
    ) {
      return tokenError("invalid_grant");
    }

    const user = await prisma.user.findUnique({
      where: { id: authCode.userId },
    });
    if (!user) return tokenError("invalid_grant");

    const refreshToken = authCode.scope.includes("offline_access")
      ? await issueRefreshToken({
          userId: user.id,
          clientDbId: client.id,
          scope: authCode.scope,
        })
      : undefined;

    return buildTokenResponse(user, client, authCode.scope, {
      nonce: authCode.nonce,
      authTime: authCode.authTime,
      refreshToken,
    });
  }

  if (grantType === "refresh_token") {
    const presented = form.get("refresh_token") as string | null;
    if (!presented) return tokenError("invalid_request");

    const result = await rotateRefreshToken(presented);
    if (!result.ok || result.clientDbId !== client.id) {
      return tokenError("invalid_grant");
    }

    const user = await prisma.user.findUnique({
      where: { id: result.userId },
    });
    if (!user) return tokenError("invalid_grant");

    return buildTokenResponse(user, client, result.scope, {
      refreshToken: result.token,
    });
  }

  return tokenError("unsupported_grant_type");
}
