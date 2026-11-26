import { NextResponse, type NextRequest } from "next/server";
import { readClientCredentials } from "@/lib/oidc/client-credentials";
import { getClient, verifyClientSecret } from "@/lib/oidc/clients";
import { deletedAccountsOf, oldestTombstone } from "@/lib/auth/account-deletion";

const NO_STORE = { "Cache-Control": "no-store" };

/**
 * The subs of this app's accounts deleted since `since` (ms since epoch; at
 * most 90 days back, the default), so it can delete their data too. Asked
 * from the app's server, with its client secret.
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const { clientId, clientSecret } = readClientCredentials(req, form);
  const client = clientId ? await getClient(clientId) : null;
  const isConfidential = !!client?.clientSecretHash;
  if (!client || !isConfidential || !verifyClientSecret(client, clientSecret)) {
    return NextResponse.json({ error: "invalid_client" }, { status: 401, headers: NO_STORE });
  }

  const asked = Number(form.get("since"));
  const since = Number.isFinite(asked) ? Math.max(asked, oldestTombstone()) : oldestTombstone();
  const subs = await deletedAccountsOf(client.id, since);
  return NextResponse.json({ subs }, { headers: NO_STORE });
}
