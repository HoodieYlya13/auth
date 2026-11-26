"use server";

import { after } from "next/server";
import { getSession, signOutEverywhere } from "@/lib/auth/session";
import { forgetIdentityVerified, isIdentityVerified } from "@/lib/auth/account-codes";
import { scheduleDeletion } from "@/lib/auth/account-deletion";
import { sendDeletionScheduled } from "@/lib/auth/account-emails";
import { CONFIRM_FIRST, NOT_SIGNED_IN, type StepResult } from "@/lib/actions/sensitive-action-guards";

export interface DeletionResult extends StepResult {
  /** ISO date the account goes. */
  deletesOn?: string;
}

/** Once it's you: the account is deleted after the grace period, and signed out everywhere now. */
export async function requestAccountDeletion(locale: string): Promise<DeletionResult> {
  const session = await getSession();
  if (!session) return NOT_SIGNED_IN;
  if (!(await isIdentityVerified(session.sessionId))) return CONFIRM_FIRST;

  const { id, email } = session.user;
  const deletesAt = await scheduleDeletion(id);
  await forgetIdentityVerified(session.sessionId);
  await signOutEverywhere(id);
  after(() => sendDeletionScheduled(email, deletesAt, locale).catch((error) => console.error("Deletion notice failed:", error)));
  return { success: true, deletesOn: deletesAt.toISOString() };
}
