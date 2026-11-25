"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import {
  browserSupportsWebAuthnAutofill,
  startAuthentication,
  type AuthenticationResponseJSON,
} from "@simplewebauthn/browser";
import {
  beginPasskeyAutofill,
  finishPasskeyAuthenticationAction,
  type PasskeyBeginResult,
} from "@/lib/actions/auth-actions";
import { rememberPasskeyOnDevice } from "@/lib/auth/passkey-on-device";
import { tryCatch } from "@/lib/utils";

export type PasskeySignInOutcome = "signed-in" | "cancelled" | "failed";

interface PasskeyMessages {
  toastInitiatingPasskey: string;
  toastSuccessPasskey: string;
  toastErrorPasskey: string;
}

interface Destination {
  locale: string;
  returnTo?: string;
}

/** Checks the passkey's answer, remembers a passkey found on this device, and goes on to where the sign-in leads. */
async function finishSignIn(
  flowId: string,
  assertion: AuthenticationResponseJSON,
  { locale, returnTo }: Destination,
): Promise<{ redirectTo: string } | { error?: string }> {
  const result = await finishPasskeyAuthenticationAction(flowId, assertion, locale, returnTo);
  if (!result.success || !result.redirectTo) return { error: result.error };
  rememberPasskeyOnDevice(assertion.authenticatorAttachment);
  return { redirectTo: result.redirectTo };
}

/** Signs in with the passkey prompt `begin` prepares: any passkey of this site, or one account's own. */
export function usePasskeySignIn(destination: Destination, messages: PasskeyMessages) {
  return async function signIn(begin: () => Promise<PasskeyBeginResult>): Promise<PasskeySignInOutcome> {
    const toastId = toast.loading(messages.toastInitiatingPasskey);
    const [error, outcome] = await tryCatch(async () => {
      const started = await begin();
      if (!started.success || !started.options || !started.flowId) return { error: started.error };
      const assertion = await startAuthentication({ optionsJSON: started.options });
      return finishSignIn(started.flowId, assertion, destination);
    });

    if (outcome && "redirectTo" in outcome) {
      toast.success(messages.toastSuccessPasskey, { id: toastId });
      window.location.href = outcome.redirectTo;
      return "signed-in";
    }
    toast.error(outcome?.error || messages.toastErrorPasskey, { id: toastId });
    return error?.name === "NotAllowedError" ? "cancelled" : "failed";
  };
}

/**
 * Offers this device's passkeys in the email field's autofill (the field's
 * autocomplete ends with "webauthn"): picking one signs in, and a device
 * without any shows nothing, never another device's QR code.
 */
export function usePasskeyAutofill(destination: Destination) {
  const { locale, returnTo } = destination;

  useEffect(() => {
    void (async () => {
      if (!(await browserSupportsWebAuthnAutofill())) return;
      const started = await beginPasskeyAutofill();
      if (!started.success || !started.options || !started.flowId) return;
      // Ends with an error when a passkey button opens its own prompt instead: nothing to do then.
      const [error, assertion] = await tryCatch(startAuthentication({ optionsJSON: started.options, useBrowserAutofill: true }));
      if (error || !assertion) return;
      const outcome = await finishSignIn(started.flowId, assertion, { locale, returnTo });
      if ("redirectTo" in outcome) window.location.href = outcome.redirectTo;
    })();
  }, [locale, returnTo]);
}
