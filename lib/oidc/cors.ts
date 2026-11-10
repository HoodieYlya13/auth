import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Client } from "@/lib/generated/prisma/client";

const PREFLIGHT_MAX_AGE_SECONDS = 600;

/** The http(s) origins of a list of redirect URIs; custom schemes have none. */
export function webOrigins(redirectUris: string[]): string[] {
  const origins = redirectUris.flatMap((uri) => {
    try {
      const url = new URL(uri);
      return url.protocol === "https:" || url.protocol === "http:"
        ? [url.origin]
        : [];
    } catch {
      return [];
    }
  });
  return [...new Set(origins)];
}

const isPublic = (client: Pick<Client, "clientSecretHash">) =>
  !client.clientSecretHash;

/** Public clients only: a confidential one calls these endpoints from its server, never from a browser. */
async function isAllowedOrigin(
  origin: string,
  client?: Client | null,
): Promise<boolean> {
  if (client) {
    return isPublic(client) && webOrigins(client.redirectUris).includes(origin);
  }
  const publicClients = await prisma.client.findMany({
    where: { clientSecretHash: null },
    select: { redirectUris: true },
  });
  return publicClients.some((c) => webOrigins(c.redirectUris).includes(origin));
}

/** Adds the CORS headers to a response when the request's origin may read it. */
export async function withCors(
  req: NextRequest,
  response: NextResponse,
  client?: Client | null,
): Promise<NextResponse> {
  const origin = req.headers.get("origin");
  response.headers.append("Vary", "Origin");
  if (origin && (await isAllowedOrigin(origin, client))) {
    response.headers.set("Access-Control-Allow-Origin", origin);
  }
  return response;
}

/** The answer to a CORS preflight, before the client is known. */
export async function preflight(
  req: NextRequest,
  methods: string[],
): Promise<Response> {
  const origin = req.headers.get("origin");
  const headers = new Headers({ Vary: "Origin" });
  if (origin && (await isAllowedOrigin(origin))) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", [...methods, "OPTIONS"].join(", "));
    headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
    headers.set("Access-Control-Max-Age", String(PREFLIGHT_MAX_AGE_SECONDS));
  }
  return new Response(null, { status: 204, headers });
}
