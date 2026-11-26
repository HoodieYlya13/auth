import "server-only";
import type { NextRequest } from "next/server";

/** The client's id and secret, from HTTP Basic or from the form (client_secret_basic and client_secret_post). */
export function readClientCredentials(
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
