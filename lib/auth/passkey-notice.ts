import "server-only";
import { emailDictionary, noticeEmail, sendEmail } from "@/lib/email";
import { accountPageUrl } from "@/lib/auth/account-page-url";

export type PasskeyChange = "added" | "removed";

/** Tells the account's owner a passkey changed, so a sign-in method never appears or disappears unnoticed. In the page's language. */
export async function sendPasskeyNotice(
  email: string,
  change: PasskeyChange,
  passkeyName: string | null,
  locale: string,
): Promise<void> {
  const t = await emailDictionary(locale);
  const subject = change === "added" ? t.passkeyAddedSubject : t.passkeyRemovedSubject;
  const ifNotYou = change === "added" ? t.passkeyAddedIfNotYou : t.passkeyRemovedIfNotYou;
  await sendEmail({
    to: email,
    subject,
    ...noticeEmail({
      title: subject,
      paragraphs: [passkeyName || t.unnamedPasskey, ifNotYou],
      button: { label: t.accountButton, href: accountPageUrl(locale) },
    }),
  });
}
