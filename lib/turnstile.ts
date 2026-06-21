import "server-only";
import { getClientIp } from "@/lib/ip";
import { tryCatch } from "@/lib/utils";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function isCaptchaEnabled(): boolean {
  return (
    process.env.NODE_ENV === "production" ||
    Boolean(process.env.TURNSTILE_SECRET_KEY)
  );
}

interface SiteVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
}

async function fetchVerifyResponse(
  secret: string,
  token: string,
): Promise<Response | null> {
  const ip = await getClientIp();
  const body = new URLSearchParams({ secret, response: token });
  if (ip && ip !== "unknown") body.set("remoteip", ip);

  const [error, response] = await tryCatch(
    fetch(SITEVERIFY_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    }),
  );

  if (error || !response.ok) {
    console.error("Turnstile siteverify request failed:", error);
    return null;
  }
  return response;
}

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV !== "production") return true;
    console.error("TURNSTILE_SECRET_KEY is not set in production.");
    return false;
  }

  if (!token) return false;

  const response = await fetchVerifyResponse(secret, token);
  if (!response) return false;

  const [parseError, data] = await tryCatch(
    response.json() as Promise<SiteVerifyResponse>,
  );

  if (parseError) {
    console.error("Turnstile siteverify response parse failed:", parseError);
    return false;
  }

  return data.success === true;
}
