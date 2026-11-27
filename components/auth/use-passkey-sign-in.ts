"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { toast } from "sonner";
import {
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  WebAuthnAbortService,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/browser";
import {
  beginPasskeyAutofill,
  finishPasskeyAuthenticationAction,
  type PasskeyBeginResult,
  type SignInDestination,
} from "@/lib/actions/auth-actions";
import { tryCatch } from "@/lib/utils";
import { forgetSignInDraft } from "@/components/auth/sign-in-draft";

export type PasskeySignInOutcome = "signed-in" | "cancelled" | "failed";

interface PasskeyMessages {
  toastErrorPasskey: string;
}


/** What the form shows meanwhile: the passkey answered and the server checks it, or it didn't work out; and whether the user gave up. */
export interface PasskeyProgress {
  onVerifying: () => void;
  onFailed: () => void;
  isCancelled: () => boolean;
}

/** Checks the passkey's answer and goes on to where the sign-in leads (kept by the server since the prompt began), saying so meanwhile. */
async function verifyAndContinue(
  flowId: string,
  assertion: AuthenticationResponseJSON,
  progress: PasskeyProgress,
  messages: PasskeyMessages,
): Promise<boolean> {
  progress.onVerifying();
  const [error, result] = await tryCatch(finishPasskeyAuthenticationAction(flowId, assertion));
  // Cancelled meanwhile: the form is back, and stays.
  if (progress.isCancelled()) return false;
  if (!error && result.success && result.redirectTo) {
    forgetSignInDraft();
    window.location.href = result.redirectTo;
    return true;
  }
  progress.onFailed();
  toast.error(result?.error || messages.toastErrorPasskey);
  return false;
}

/** Signs in with the passkey prompt `begin` prepares (with the sign-in's destination): any passkey of this site, or one account's own. */
export function usePasskeySignIn(messages: PasskeyMessages, progress: PasskeyProgress) {
  return async function signIn(begin: () => Promise<PasskeyBeginResult>): Promise<PasskeySignInOutcome> {
    const [beginError, started] = await tryCatch(begin());
    if (beginError || !started.success || !started.options || !started.flowId) {
      toast.error(started?.error || messages.toastErrorPasskey);
      return "failed";
    }
    const [promptError, assertion] = await tryCatch(startAuthentication({ optionsJSON: started.options }));
    if (promptError || !assertion) {
      toast.error(messages.toastErrorPasskey);
      return promptError?.name === "NotAllowedError" ? "cancelled" : "failed";
    }
    const isSignedIn = await verifyAndContinue(started.flowId, assertion, progress, messages);
    return isSignedIn ? "signed-in" : "failed";
  };
}

/**
 * Offers this device's passkeys in the email field's autofill (the field's
 * autocomplete ends with "webauthn"): picking one signs in, and a device
 * without any shows nothing, never another device's QR code.
 */
export function usePasskeyAutofill(destination: SignInDestination, messages: PasskeyMessages, progress: PasskeyProgress) {
  const { locale, returnTo } = destination;
  const verify = useEffectEvent((flowId: string, assertion: AuthenticationResponseJSON) => verifyAndContinue(flowId, assertion, progress, messages));
  const pageRestoreCount = useAutofillStoppedWhileHidden();

  useEffect(() => {
    void (async () => {
      if (!(await browserSupportsWebAuthnAutofill())) return;
      const started = await beginPasskeyAutofill({ locale, returnTo });
      if (!started.success || !started.options || !started.flowId) return;
      // Ends with an error when a passkey button opens its own prompt instead: nothing to do then.
      const [error, assertion] = await tryCatch(startAuthentication({ optionsJSON: started.options, useBrowserAutofill: true }));
      if (error || !assertion) return;
      await verify(started.flowId, assertion);
    })();
  }, [locale, returnTo, pageRestoreCount]);
}

/**
 * Stops the autofill request when the page is hidden: one left waiting in Safari's back-forward
 * cache takes the passkey picked on the next sign-in page. Counts the restores, to listen again.
 */
function useAutofillStoppedWhileHidden(): number {
  const [pageRestoreCount, setPageRestoreCount] = useState(0);

  useEffect(() => {
    const stopListening = () => WebAuthnAbortService.cancelCeremony();
    const listenAgainWhenRestored = (event: PageTransitionEvent) => {
      if (event.persisted) setPageRestoreCount((count) => count + 1);
    };
    window.addEventListener("pagehide", stopListening);
    window.addEventListener("pageshow", listenAgainWhenRestored);
    return () => {
      window.removeEventListener("pagehide", stopListening);
      window.removeEventListener("pageshow", listenAgainWhenRestored);
    };
  }, []);

  return pageRestoreCount;
}
