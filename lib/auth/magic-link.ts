import "server-only";
import { EMAIL_BUTTON_STYLE, EMAIL_STYLE, emailDictionary, sendEmail, type EmailDict } from "@/lib/email";
import { getRedis } from "@/lib/redis";
import { randomInt } from "node:crypto";
import { randomToken, safeEqual, sha256Base64Url } from "@/lib/crypto";

const TTL_SECONDS = 60 * 15; // 15 minutes
const PREFIX = "ml:";
// The same sign-in as a 6-digit code, for whoever would rather type it than
// open the link (which lands in a new tab, or another browser).
const CODE_PREFIX = "mlc:";
const CODE_TRIES_PREFIX = "mlct:";
/** Wrong codes allowed before the code stops working (the link still does). */
const CODE_MAX_TRIES = 5;

export interface MagicLinkPayload {
  email: string;
  locale?: string;
  returnTo?: string;
}

interface MagicCode {
  /** sha256 of the code: a leaked Redis dump doesn't hand out sign-ins. */
  codeHash: string;
  token: string;
}

/** A sign-in link and its code. Only the newest code of an email works. */
export async function createMagicLinkToken(
  payload: MagicLinkPayload,
): Promise<{ token: string; code: string }> {
  const token = randomToken();
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const email = payload.email.toLowerCase();
  const redis = getRedis();
  await Promise.all([
    redis.set(`${PREFIX}${token}`, { ...payload, email } satisfies MagicLinkPayload, { ex: TTL_SECONDS }),
    redis.set(`${CODE_PREFIX}${email}`, { codeHash: sha256Base64Url(code), token } satisfies MagicCode, { ex: TTL_SECONDS }),
    redis.del(`${CODE_TRIES_PREFIX}${email}`),
  ]);
  return { token, code };
}

/** Single use: read and deleted in one step. The code that came with it goes too. */
export async function consumeMagicLinkToken(
  token: string,
): Promise<MagicLinkPayload | null> {
  const redis = getRedis();
  const payload = await redis.getdel<MagicLinkPayload>(`${PREFIX}${token}`);
  if (payload) {
    const code = await redis.get<MagicCode>(`${CODE_PREFIX}${payload.email}`);
    if (code?.token === token) await redis.del(`${CODE_PREFIX}${payload.email}`, `${CODE_TRIES_PREFIX}${payload.email}`);
  }
  return payload;
}

/**
 * Signs in with the code from the email instead of the link: same single use,
 * and a few wrong guesses end the code (a million codes, five tries).
 */
export async function consumeMagicCode(
  email: string,
  code: string,
): Promise<MagicLinkPayload | null> {
  const redis = getRedis();
  const key = `${CODE_PREFIX}${email.toLowerCase()}`;
  const triesKey = `${CODE_TRIES_PREFIX}${email.toLowerCase()}`;
  const saved = await redis.get<MagicCode>(key);
  if (!saved) return null;
  if (!safeEqual(sha256Base64Url(code), saved.codeHash)) {
    const tries = await redis.incr(triesKey);
    if (tries === 1) await redis.expire(triesKey, TTL_SECONDS);
    if (tries >= CODE_MAX_TRIES) await redis.del(key, triesKey);
    return null;
  }
  // Only one of two simultaneous right answers gets the code.
  if (!(await redis.del(key))) return null;
  await redis.del(triesKey);
  return redis.getdel<MagicLinkPayload>(`${PREFIX}${saved.token}`);
}

/** Whether a link is still valid, without using it (the confirmation page). */
export async function peekMagicLinkToken(
  token: string,
): Promise<MagicLinkPayload | null> {
  return getRedis().get<MagicLinkPayload>(`${PREFIX}${token}`);
}

/** Without a link, the email has only the code (for an app's sign-in). In the language of the sign-in page. */
export async function sendMagicLinkEmail(
  email: string,
  code: string,
  link: string | undefined,
  locale: string | undefined,
): Promise<void> {
  if (process.env.NODE_ENV !== "production")
    return console.log(`🔗 Magic Link: ${link ?? "(code only)"}\n🔢 Code: ${code}`);

  const t = await emailDictionary(locale);
  await sendEmail({
    to: email,
    subject: link ? t.signInLinkSubject : t.signInCodeSubject.replace("{code}", code),
    text: link ? magicLinkText(t, link, code) : magicCodeText(t, code),
    html: link ? magicLinkHtml(t, link, code) : magicCodeHtml(t, code),
  });
}

function magicLinkText(t: EmailDict, link: string, code: string): string {
  return `${t.signInLinkTextIntro}\n\n${link}\n\n${t.signInOrCode} ${code}\n\n${t.ignoreNote}`;
}

function magicCodeText(t: EmailDict, code: string): string {
  return `${t.signInCodeIntro}\n\n${code}\n\n${t.ignoreNote}`;
}

function codeHtml(code: string): string {
  return `<p style="font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:8px;margin:0">${code}</p>`;
}

function magicLinkHtml(t: EmailDict, link: string, code: string): string {
  return `
  <div style="${EMAIL_STYLE}">
    <h1 style="font-size:18px;margin:0 0 8px">${t.signInTitle}</h1>
    <p style="font-size:14px;color:#525252;margin:0 0 24px">${t.signInLinkIntro}</p>
    <a href="${link}" style="${EMAIL_BUTTON_STYLE}">${t.signInButton}</a>
    <p style="font-size:14px;color:#525252;margin:28px 0 8px">${t.signInOrCode}</p>
    ${codeHtml(code)}
    <p style="font-size:12px;color:#a3a3a3;margin:24px 0 0;word-break:break-all">${link}</p>
  </div>`;
}

function magicCodeHtml(t: EmailDict, code: string): string {
  return `
  <div style="${EMAIL_STYLE}">
    <h1 style="font-size:18px;margin:0 0 8px">${t.signInTitle}</h1>
    <p style="font-size:14px;color:#525252;margin:0 0 24px">${t.signInCodeIntro}</p>
    ${codeHtml(code)}
    <p style="font-size:12px;color:#a3a3a3;margin:24px 0 0">${t.ignoreNote}</p>
  </div>`;
}
