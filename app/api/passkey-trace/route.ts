import type { NextRequest } from "next/server";

const MAX_TRACE_LENGTH = 2000;

/** Temporary: prints what the sign-in page reports about passkey autofill on iPhones. */
export async function POST(request: NextRequest): Promise<Response> {
  const trace = (await request.text()).slice(0, MAX_TRACE_LENGTH);
  const userAgent = request.headers.get("user-agent") ?? "unknown";
  console.log(`[passkey-trace] ${trace} | ${userAgent}`);
  return new Response(null, { status: 204 });
}
