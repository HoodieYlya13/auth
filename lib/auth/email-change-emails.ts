import "server-only";
import { EMAIL_STYLE, emailCodeHtml, emailDictionary, escapeHtml, sendEmail } from "@/lib/email";
import type { EmailChangeStep } from "@/lib/auth/email-change";

/** The code proving it's you (to the current address) or that the new address is yours. In the page's language. */
export async function sendEmailChangeCode(to: string, code: string, step: EmailChangeStep, locale: string): Promise<void> {
  if (process.env.NODE_ENV !== "production") return console.log(`✉️ Email change code (${step}) → ${to}: ${code}`);
  const t = await emailDictionary(locale);
  const intro = step === "current" ? t.emailChangeCurrentIntro : t.emailChangeNewIntro;
  await sendEmail({
    to,
    subject: t.emailChangeCodeSubject.replace("{code}", code),
    text: `${intro}\n\n${code}\n\n${t.ignoreNote}`,
    html: `
  <div style="${EMAIL_STYLE}">
    <p style="font-size:14px;color:#525252;margin:0 0 24px">${intro}</p>
    ${emailCodeHtml(code)}
    <p style="font-size:12px;color:#a3a3a3;margin:24px 0 0">${t.ignoreNote}</p>
  </div>`,
  });
}

/** To the old address once the change is done: an account never moves away from its owner unnoticed. */
export async function sendEmailChangedNotice(oldEmail: string, newEmail: string, locale: string): Promise<void> {
  const t = await emailDictionary(locale);
  const body = t.emailChangedBody.replace("{email}", newEmail);
  await sendEmail({
    to: oldEmail,
    subject: t.emailChangedSubject,
    text: `${body}\n\n${t.emailChangedIfNotYou}`,
    html: `
  <div style="${EMAIL_STYLE}">
    <h1 style="font-size:18px;margin:0 0 8px">${t.emailChangedSubject}</h1>
    <p style="font-size:14px;color:#525252;margin:0 0 24px">${escapeHtml(body)}</p>
    <p style="font-size:14px;color:#525252;margin:0">${t.emailChangedIfNotYou}</p>
  </div>`,
  });
}
