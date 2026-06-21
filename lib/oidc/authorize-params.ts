import "server-only";

const ISSUER = process.env.ISSUER ?? "http://localhost:3000";

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
}

export function parseAuthorizeReturnTo(
  returnTo: string,
): AuthorizeParams | null {
  let url: URL;
  try {
    url = new URL(returnTo, ISSUER);
  } catch {
    return null;
  }
  if (url.pathname !== "/api/oidc/authorize") return null;
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  if (!clientId || !redirectUri) return null;
  return {
    clientId,
    redirectUri,
    scope: url.searchParams.get("scope") ?? "openid",
    state: url.searchParams.get("state") ?? undefined,
  };
}
