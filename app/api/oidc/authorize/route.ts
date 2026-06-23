import { NextResponse, type NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { getClient, isValidRedirectUri } from "@/lib/oidc/clients";
import { issueAuthCode } from "@/lib/oidc/codes";
import { SUPPORTED_SCOPES } from "@/lib/oidc/discovery";
import {
  getDictionary,
  hasLocale,
  type Locale,
} from "@/lib/dictionaries/dictionaries";

const DEFAULT_LOCALE = "en";

function pickLocale(req: NextRequest): Locale {
  const first =
    req.headers
      .get("accept-language")
      ?.split(",")[0]
      ?.trim()
      .slice(0, 2)
      .toLowerCase() ?? "";
  return hasLocale(first) ? first : DEFAULT_LOCALE;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function badRequest(message: string) {
  return new NextResponse(`Authorization error: ${message}`, {
    status: 400,
    headers: { "content-type": "text/plain" },
  });
}

function isWebRedirect(url: URL): boolean {
  return url.protocol === "http:" || url.protocol === "https:";
}

function deepLinkHandoff(
  target: string,
  lang: Locale,
  t: { title: string; message: string; button: string },
): NextResponse {
  const json = JSON.stringify(target);
  const html = `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(t.title)}</title>
<style>
  :root { color-scheme: light dark; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center;
    font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    background: #fafafa; color: #0a0a0a; }
  @media (prefers-color-scheme: dark) { body { background: #0a0a0a; color: #fafafa; } }
  main { text-align: center; padding: 2rem; max-width: 22rem; }
  h1 { font-size: 1.125rem; margin: 0 0 0.5rem; }
  p { font-size: 0.875rem; opacity: 0.7; margin: 0 0 1.25rem; line-height: 1.5; }
  a { display: inline-block; font-size: 0.875rem; font-weight: 600; text-decoration: none;
    padding: 0.5rem 0.9rem; border-radius: 0.6rem; border: 1px solid currentColor; color: inherit; }
</style>
</head>
<body>
  <main>
    <h1>${escapeHtml(t.title)}</h1>
    <p>${escapeHtml(t.message)}</p>
    <a href="/${lang}/account">${escapeHtml(t.button)}</a>
  </main>
  <script>
    var target = ${json};
    location.href = target;
    setTimeout(function () { try { window.close(); } catch (e) {} }, 400);
  </script>
</body>
</html>`;
  return new NextResponse(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    },
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
  const locale = pickLocale(req);

  const interactiveReturn = (() => {
    const u = new URL(selfUrl, origin);
    u.searchParams.set("_handoff", "1");
    return u.pathname + u.search;
  })();

  const user = await getCurrentUser();
  if (!user) {
    const login = new URL(`/${locale}`, origin);
    login.searchParams.set("return_to", interactiveReturn);
    return NextResponse.redirect(login);
  }

  if (!user.username) {
    const reg = new URL(
      `/${locale}/auth/complete-registration`,
      origin,
    );
    reg.searchParams.set("return_to", interactiveReturn);
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
      const consent = new URL(`/${locale}/consent`, origin);
      consent.searchParams.set("return_to", interactiveReturn);
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

  if (p.get("_handoff") === "1" && !isWebRedirect(back)) {
    const { handoff } = await getDictionary(locale);
    return deepLinkHandoff(back.toString(), locale, handoff);
  }

  return NextResponse.redirect(back);
}
