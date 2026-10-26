import { prisma } from "@/lib/db";

// Public so OIDC clients can render the `picture` claim without a token.
export async function GET(
  req: Request,
  { params }: RouteContext<"/api/avatar/[id]">,
) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response(null, { status: 404 });

  const avatar = await prisma.avatar.findUnique({ where: { userId: id } });
  if (!avatar) return new Response(null, { status: 404 });

  const versioned = new URL(req.url).searchParams.has("v");
  return new Response(new Uint8Array(avatar.data), {
    headers: {
      "Content-Type": avatar.contentType,
      "Cache-Control": versioned
        ? "public, max-age=31536000, immutable"
        : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
