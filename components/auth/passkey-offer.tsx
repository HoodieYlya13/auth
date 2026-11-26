"use client";

import { ArrowLeft, Fingerprint, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PasskeySignInOutcome } from "@/components/auth/use-passkey-sign-in";
import type { PasskeyBeginResult } from "@/lib/actions/auth-actions";
import { useStateResetOnBack } from "@/components/use-state-reset-on-back";

interface PasskeyOfferDict {
  passkeyOfferTitle: string;
  passkeyOfferDescription: string;
  usePasskey: string;
  sendCodeInstead: string;
  codeOtherEmail: string;
}

/**
 * A code was asked for an account that has a passkey: use it instead? The
 * prompt only takes that account's passkeys, so a device holding one (synced
 * ones included) uses it at once, and only a device without any offers to use
 * the phone.
 */
export function PasskeyOffer({
  email,
  passkeyPrompt,
  signIn,
  onSendCode,
  onBack,
  dict,
}: {
  email: string;
  passkeyPrompt: PasskeyBeginResult;
  signIn: (begin: () => Promise<PasskeyBeginResult>) => Promise<PasskeySignInOutcome>;
  onSendCode: () => void;
  onBack: () => void;
  dict: PasskeyOfferDict;
}) {
  const [isSigningIn, setIsSigningIn] = useStateResetOnBack(false);

  async function signInWithPasskey() {
    setIsSigningIn(true);
    const outcome = await signIn(() => Promise.resolve(passkeyPrompt));
    if (outcome !== "signed-in") setIsSigningIn(false);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Fingerprint className="size-4" />
          {dict.passkeyOfferTitle}
        </h2>
        <p className="text-sm text-muted-foreground leading-normal break-words">
          {dict.passkeyOfferDescription.replace("{email}", email)}
        </p>
      </div>
      <Button
        type="button"
        autoFocus
        onClick={() => void signInWithPasskey()}
        disabled={isSigningIn}
        className="w-full h-9 cursor-pointer font-semibold shadow-xs flex items-center justify-center gap-2"
      >
        {isSigningIn ? <Loader2 className="animate-spin size-4 text-primary-foreground" /> : <Fingerprint className="size-4" />}
        {dict.usePasskey}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onSendCode}
        disabled={isSigningIn}
        className="w-full h-9 cursor-pointer font-semibold shadow-xs border-input hover:bg-accent flex items-center justify-center gap-2"
      >
        <Mail className="size-4" />
        {dict.sendCodeInstead}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={isSigningIn}
        className="w-full h-9 cursor-pointer text-muted-foreground flex items-center justify-center gap-2"
      >
        <ArrowLeft className="size-4" />
        {dict.codeOtherEmail}
      </Button>
    </div>
  );
}
