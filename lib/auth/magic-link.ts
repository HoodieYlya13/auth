import "server-only";
import { Resend } from "resend";
import { getRedis } from "@/lib/redis";
import { randomToken } from "@/lib/crypto";

const TTL_SECONDS = 60 * 15; // 15 minutes
const PREFIX = "ml:";

export interface MagicLinkPayload {
  email: string;
  locale?: string;
  returnTo?: string;
}

export async function createMagicLinkToken(
  payload: MagicLinkPayload,
): Promise<string> {
  const token = randomToken();
  await getRedis().set(
    `${PREFIX}${token}`,
    {
      ...payload,
      email: payload.email.toLowerCase(),
    } satisfies MagicLinkPayload,
    { ex: TTL_SECONDS },
  );
  return token;
}

export async function consumeMagicLinkToken(
  token: string,
): Promise<MagicLinkPayload | null> {
  const redis = getRedis();
  const key = `${PREFIX}${token}`;
  const payload = await redis.get<MagicLinkPayload>(key);
  if (!payload) return null;
  await redis.del(key);
  return payload;
}

export async function sendMagicLinkEmail(
  email: string,
  link: string,
): Promise<void> {
  if (process.env.NODE_ENV !== "production")
    return console.log(`🔗 Magic Link: ${link}`);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM_MAGIC_LINK ?? "Auth <onboarding@resend.dev>",
    to: email,
    subject: "Your sign-in link",
    text: `Click to sign in (valid for 15 minutes):\n\n${link}\n\nIf you didn't request this, you can ignore this email.`,
    html: magicLinkHtml(link),
  });
  if (error) throw new Error(`Failed to send magic link: ${error.message}`);
}

function magicLinkHtml(link: string): string {
  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#0a0a0a">
    <h1 style="font-size:18px;margin:0 0 8px">Sign in</h1>
    <p style="font-size:14px;color:#525252;margin:0 0 24px">Click the button below to sign in. This link is valid for 15 minutes and can be used once.</p>
    <a href="${link}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px">Sign in</a>
    <p style="font-size:12px;color:#a3a3a3;margin:24px 0 0;word-break:break-all">${link}</p>
  </div>`;
}
