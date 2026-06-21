import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getClient, isValidRedirectUri } from "@/lib/oidc/clients";
import { issueAuthCode } from "@/lib/oidc/codes";
import { SUPPORTED_SCOPES } from "@/lib/oidc/discovery";

const DEFAULT_LOCALE = "en";

function badRequest(message: string) {
  return new NextResponse(`Authorization error: ${message}`, {
    status: 400,
    headers: { "content-type": "text/plain" },
  });
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const clientId = p.get("client_id");
  const redirectUri = p.get("redirect_uri");
  const responseType = p.get("response_type");
  const scope = p.get("scope") ?? "openid";
  const state = p.get("state") ?? undefined;
  const codeChallenge = p.get("code_challenge");
  const codeChallengeMethod = p.get("code_challenge_method");
  const nonce = p.get("nonce") ?? undefined;

  if (!clientId) return badRequest("missing client_id");
  const client = await getClient(clientId);
  if (!client) return badRequest("unknown client_id");
  if (!redirectUri || !isValidRedirectUri(client, redirectUri))
    return badRequest("invalid redirect_uri");

  const redirectError = (error: string, description?: string) => {
    const url = new URL(redirectUri);
    url.searchParams.set("error", error);
    if (description) url.searchParams.set("error_description", description);
    if (state) url.searchParams.set("state", state);
    return NextResponse.redirect(url);
  };

  if (responseType !== "code")
    return redirectError("unsupported_response_type");
  if (!codeChallenge || codeChallengeMethod !== "S256")
    return redirectError("invalid_request", "PKCE with S256 is required");

  const requested = scope.split(/\s+/).filter(Boolean);
  if (!requested.includes("openid"))
    return redirectError("invalid_scope", "openid scope is required");
  const granted = requested.filter(
    (s) =>
      SUPPORTED_SCOPES.includes(s) &&
      (client.allowedScopes.length === 0 || client.allowedScopes.includes(s)),
  );
  const grantedScope = granted.join(" ");

  const selfUrl = req.nextUrl.pathname + req.nextUrl.search;
  const origin = req.nextUrl.origin;

  const user = await getCurrentUser();
  if (!user) {
    const login = new URL(`/${DEFAULT_LOCALE}`, origin);
    login.searchParams.set("return_to", selfUrl);
    return NextResponse.redirect(login);
  }

  if (!user.username) {
    const reg = new URL(
      `/${DEFAULT_LOCALE}/auth/complete-registration`,
      origin,
    );
    reg.searchParams.set("return_to", selfUrl);
    return NextResponse.redirect(reg);
  }

  if (client.trusted) {
    await prisma.appMembership.upsert({
      where: { userId_clientId: { userId: user.id, clientId: client.id } },
      update: {},
      create: {
        userId: user.id,
        clientId: client.id,
        roles: client.defaultRoles.length ? client.defaultRoles : ["USER"],
        scopesGranted: granted,
      },
    });
  } else {
    const membership = await prisma.appMembership.findUnique({
      where: { userId_clientId: { userId: user.id, clientId: client.id } },
    });
    if (!membership) {
      const consent = new URL(`/${DEFAULT_LOCALE}/consent`, origin);
      consent.searchParams.set("return_to", selfUrl);
      return NextResponse.redirect(consent);
    }
  }

  const code = await issueAuthCode({
    userId: user.id,
    clientId: client.clientId,
    redirectUri,
    scope: grantedScope,
    codeChallenge,
    nonce,
    authTime: Math.floor(Date.now() / 1000),
  });

  const back = new URL(redirectUri);
  back.searchParams.set("code", code);
  if (state) back.searchParams.set("state", state);
  return NextResponse.redirect(back);
}
