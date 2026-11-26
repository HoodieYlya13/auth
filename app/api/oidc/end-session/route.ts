import { NextResponse, type NextRequest } from "next/server";
import { revokeSession } from "@/lib/auth/session";
import { readClientCredentials } from "@/lib/oidc/client-credentials";
import { getClient, verifyClientSecret } from "@/lib/oidc/clients";
import { sessionOfRefreshToken } from "@/lib/oidc/refresh";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * Signs out from an app's server, without sending the browser here: a
 * confidential client presents its secret and a refresh token, and the sign-in
 * that token came from ends, here and in every app it signed into. Like token
 * revocation, an unknown token still answers 200.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const { clientId, clientSecret } = readClientCredentials(req, form);
  const client = clientId ? await getClient(clientId) : null;
  const isConfidential = !!client?.clientSecretHash;
  if (!client || !isConfidential || !verifyClientSecret(client, clientSecret)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401, headers: NO_STORE });
  }

  const refreshToken = form.get("refresh_token");
  if (typeof refreshToken !== "string" || !refreshToken) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400, headers: NO_STORE });
  }

  const signIn = await sessionOfRefreshToken(refreshToken, client.id);
  if (signIn) await revokeSession(signIn.sessionId, signIn.userId);
  return new NextResponse(null, { status: 200, headers: NO_STORE });
}
