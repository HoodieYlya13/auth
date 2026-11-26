import "server-only";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { deviceName } from "@/lib/device-name";
import { findSigningInApp } from "@/lib/oidc/clients";
import { isNewDeviceFor } from "@/lib/auth/known-devices";
import { cancelDeletion } from "@/lib/auth/account-deletion";
import { sendDeletionCancelled, sendNewDeviceNotice } from "@/lib/auth/account-emails";

/** Where a sign-in happened: its browser, the page's language, and where it leads. */
export interface SignInContext {
  userAgent?: string;
  locale: string;
  returnTo?: string;
}

/**
 * What a sign-in sets off: a deletion asked for earlier is called off, and a
 * device the account hadn't used gets the owner an email. Emails go once the
 * answer is sent.
 */
export async function noticeSignIn(userId: string, signIn: SignInContext): Promise<void> {
  const [isNewDevice, wasDeletionPending] = await Promise.all([isNewDeviceFor(userId), cancelDeletion(userId)]);
  if (!isNewDevice && !wasDeletionPending) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return;
  const app = isNewDevice ? await findSigningInApp(signIn.returnTo) : null;

  after(async () => {
    const sent = await Promise.allSettled([
      ...(wasDeletionPending ? [sendDeletionCancelled(user.email, signIn.locale)] : []),
      ...(isNewDevice
        ? [sendNewDeviceNotice(user.email, { device: signIn.userAgent ? deviceName(signIn.userAgent) : null, appName: app?.name ?? null, locale: signIn.locale })]
        : []),
    ]);
    sent.forEach((result) => result.status === "rejected" && console.error("Sign-in notice failed:", result.reason));
  });
}
