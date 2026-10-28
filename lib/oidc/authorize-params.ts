import "server-only";
import { safeReturnTo } from "@/lib/redirect";

export interface AuthorizeParams {
  /** The authorize request as a path on this site, safe to redirect to. */
  path: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  state?: string;
}

/**
 * Reads an authorize request carried in `return_to` (consent, sign-in).
 * Only a path to this site's authorize endpoint is accepted: an absolute URL
 * with the same path could point anywhere.
 */
export function parseAuthorizeReturnTo(
  returnTo: string,
): AuthorizeParams | null {
  const path = safeReturnTo(returnTo);
  if (!path) return null;
  const url = new URL(path, "http://authorize.invalid");
  if (url.pathname !== "/api/oidc/authorize") return null;
  const clientId = url.searchParams.get("client_id");
  const redirectUri = url.searchParams.get("redirect_uri");
  if (!clientId || !redirectUri) return null;
  return {
    path,
    clientId,
    redirectUri,
    scope: url.searchParams.get("scope") ?? "openid",
    state: url.searchParams.get("state") ?? undefined,
  };
}
