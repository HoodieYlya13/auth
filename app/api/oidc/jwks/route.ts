import { getJwks } from "@/lib/oidc/keys";

// Served at /.well-known/jwks.json via a rewrite in next.config.ts.
export async function GET() {
  return Response.json(await getJwks(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
