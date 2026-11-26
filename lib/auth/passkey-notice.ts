import "server-only";
import { EMAIL_BUTTON_STYLE, EMAIL_STYLE, emailDictionary, escapeHtml, sendEmail } from "@/lib/email";
import { hasLocale } from "@/lib/dictionaries/dictionaries";

const ISSUER = process.env.ISSUER ?? "http://localhost:3000";

export type PasskeyChange = "added" | "removed";

/** Tells the account's owner a passkey changed, so a sign-in method never appears or disappears unnoticed. In the page's language. */
export async function sendPasskeyNotice(
  email: string,
  change: PasskeyChange,
  passkeyName: string | null,
  locale: string,
): Promise<void> {
  const t = await emailDictionary(locale);
  const accountPage = `${ISSUER}/${hasLocale(locale) ? locale : "en"}/account`;
  const subject = change === "added" ? t.passkeyAddedSubject : t.passkeyRemovedSubject;
  const ifNotYou = change === "added" ? t.passkeyAddedIfNotYou : t.passkeyRemovedIfNotYou;
  const name = passkeyName || t.unnamedPasskey;
  await sendEmail({
    to: email,
    subject,
    text: `${subject}: ${name}.\n\n${ifNotYou}\n\n${accountPage}`,
    html: `
  <div style="${EMAIL_STYLE}">
    <h1 style="font-size:18px;margin:0 0 8px">${subject}</h1>
    <p style="font-size:14px;color:#525252;margin:0 0 24px">${escapeHtml(name)}</p>
    <p style="font-size:14px;color:#525252;margin:0 0 24px">${ifNotYou}</p>
    <a href="${accountPage}" style="${EMAIL_BUTTON_STYLE}">${t.accountButton}</a>
  </div>`,
  });
}
