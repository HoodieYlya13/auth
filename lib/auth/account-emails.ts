import "server-only";
import { EMAIL_STYLE, emailCodeHtml, emailDictionary, noticeEmail, sendEmail } from "@/lib/email";
import { accountPageUrl, claimBackUrl } from "@/lib/auth/account-page-url";
import type { AccountCodePurpose } from "@/lib/auth/account-codes";

/** A code proving it's you (to your address) or that a new address is yours. In the page's language. */
export async function sendAccountCode(to: string, code: string, purpose: AccountCodePurpose, locale: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") return console.log(`✉️ Account code (${purpose}) → ${to}: ${code}`);
  const t = await emailDictionary(locale);
  const isIdentity = purpose === "identity";
  const intro = isIdentity ? t.identityCodeIntro : t.newEmailCodeIntro;
  const subject = (isIdentity ? t.identityCodeSubject : t.newEmailCodeSubject).replace("{code}", code);
  await sendEmail({
    to,
    subject,
    text: `${intro}\n\n${code}\n\n${t.ignoreNote}`,
    html: `
  <div style="${EMAIL_STYLE}">
    <p style="font-size:14px;color:#525252;margin:0 0 24px">${intro}</p>
    ${emailCodeHtml(code)}
    <p style="font-size:12px;color:#a3a3a3;margin:24px 0 0">${t.ignoreNote}</p>
  </div>`,
  });
}

/** To the old address once the change is done: an account never moves away from its owner unnoticed, nor for good. */
export async function sendEmailChangedNotice(
  change: { oldEmail: string; newEmail: string; claimBackToken: string },
  locale: string,
): Promise<void> {
  const t = await emailDictionary(locale);
  await sendEmail({
    to: change.oldEmail,
    subject: t.emailChangedSubject,
    ...noticeEmail({
      title: t.emailChangedSubject,
      paragraphs: [t.emailChangedBody.replace("{email}", change.newEmail), t.emailChangedIfNotYou],
      button: { label: t.claimBackButton, href: claimBackUrl(locale, change.claimBackToken) },
    }),
  });
}

/** To the address the account just left: the former one took it back. */
export async function sendEmailClaimedBackNotice(droppedEmail: string, locale: string): Promise<void> {
  const t = await emailDictionary(locale);
  await sendEmail({
    to: droppedEmail,
    subject: t.claimedBackSubject,
    ...noticeEmail({ title: t.claimedBackSubject, paragraphs: [t.claimedBackBody] }),
  });
}

const formatDate = (date: Date, locale: string) => new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(date);

export async function sendDeletionScheduled(email: string, deletesAt: Date, locale: string): Promise<void> {
  const t = await emailDictionary(locale);
  const date = formatDate(deletesAt, locale);
  const subject = t.deletionScheduledSubject.replace("{date}", date);
  await sendEmail({
    to: email,
    subject,
    ...noticeEmail({ title: subject, paragraphs: [t.deletionScheduledBody.replace("{date}", date), t.deletionScheduledKeep] }),
  });
}

export async function sendDeletionCancelled(email: string, locale: string): Promise<void> {
  const t = await emailDictionary(locale);
  await sendEmail({
    to: email,
    subject: t.deletionCancelledSubject,
    ...noticeEmail({ title: t.deletionCancelledSubject, paragraphs: [t.deletionCancelledBody] }),
  });
}

/** A sign-in from a device the account hadn't used: the owner hears of it, and of the app it was for. */
export async function sendNewDeviceNotice(
  email: string,
  signIn: { device: string | null; appName: string | null; locale: string },
): Promise<void> {
  const t = await emailDictionary(signIn.locale);
  const device = signIn.device ?? t.unknownDevice;
  const body = signIn.appName
    ? t.newDeviceBodyForApp.replace("{device}", device).replace("{app}", signIn.appName)
    : t.newDeviceBody.replace("{device}", device);
  await sendEmail({
    to: email,
    subject: t.newDeviceSubject,
    ...noticeEmail({
      title: t.newDeviceSubject,
      paragraphs: [body, t.newDeviceIfNotYou],
      button: { label: t.accountButton, href: accountPageUrl(signIn.locale) },
    }),
  });
}
