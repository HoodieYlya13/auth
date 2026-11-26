import "server-only";
import { headers } from "next/headers";

/** Temporary: traces where sign-ins lose their way back to the app on iOS. Facts only, nothing personal. */
export async function logReturnTo(step: string, facts: Record<string, boolean | string | undefined>): Promise<void> {
  const userAgent = (await headers()).get("user-agent") ?? "";
  const device = /iPhone|iPad/.test(userAgent) ? "iOS" : "other";
  console.warn(`[return-to] ${step} ${device} ${JSON.stringify(facts)}`);
}
