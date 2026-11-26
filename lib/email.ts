import "server-only";
import { Resend } from "resend";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";

export const EMAIL_STYLE =
  "font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;max-width:420px;margin:0 auto;padding:32px 24px;color:#0a0a0a";

export const EMAIL_BUTTON_STYLE =
  "display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:10px 20px;border-radius:8px";

export interface Email {
  to: string;
  subject: string;
  text: string;
  html: string;
}

/** Sent with Resend in production; outside it, only logged. */
export async function sendEmail(email: Email): Promise<void> {
  if (process.env.NODE_ENV !== "production") return console.log(`✉️ ${email.subject} → ${email.to}\n${email.text}`);

  const resend = new Resend(process.env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: process.env.EMAIL_FROM_MAGIC_LINK ?? "Auth <onboarding@resend.dev>",
    ...email,
  });
  if (error) throw new Error(`Failed to send "${email.subject}": ${error.message}`);
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

/** Text the user chose (a passkey's name), safe inside an email's HTML. */
export const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character]);

export type EmailDict = Awaited<ReturnType<typeof getDictionary>>["emails"];

/** The emails' wording in the language of the page the action came from (English otherwise). */
export async function emailDictionary(locale: string | undefined): Promise<EmailDict> {
  return (await getDictionary(locale && hasLocale(locale) ? locale : "en")).emails;
}
