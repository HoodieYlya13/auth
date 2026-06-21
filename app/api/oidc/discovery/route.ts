import { getDiscoveryDocument } from "@/lib/oidc/discovery";

// Served at /.well-known/openid-configuration via a rewrite in next.config.ts.
export function GET() {
  return Response.json(getDiscoveryDocument(), {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
