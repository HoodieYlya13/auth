"use client";

import { useState } from "react";
import { ArrowLeft, Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { beginPasskeyAuthenticationForEmail } from "@/lib/actions/auth-actions";
import type { PasskeySignInOutcome } from "@/components/auth/use-passkey-sign-in";
import type { PasskeyBeginResult } from "@/lib/actions/auth-actions";
import { tryCatch } from "@/lib/utils";

interface PasskeyEmailDict {
  emailLabel: string;
  emailPlaceholder: string;
  passkeyEmailTitle: string;
  passkeyEmailDescription: string;
  passkeyEmailSubmit: string;
  passkeyEmailBack: string;
  noPasskeyForEmail: string;
  toastErrorPasskey: string;
}

/**
 * Passkey sign-in on a browser that hasn't used one here: the email first,
 * then the account's own passkeys. A device holding one (synced ones
 * included) uses it at once; only a device without any offers another
 * device's QR code. An account without a passkey signs in by email instead.
 */
export function PasskeyEmailStep({
  initialEmail,
  signIn,
  onNoPasskey,
  onBack,
  dict,
}: {
  initialEmail: string;
  signIn: (begin: () => Promise<PasskeyBeginResult>) => Promise<PasskeySignInOutcome>;
  onNoPasskey: (email: string) => void;
  onBack: () => void;
  dict: PasskeyEmailDict;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(value: string) {
    setIsSubmitting(true);
    const [error, found] = await tryCatch(beginPasskeyAuthenticationForEmail(value));
    if (error || !found?.success) {
      setIsSubmitting(false);
      toast.error(found?.error || dict.toastErrorPasskey);
      return;
    }
    if (!found.hasPasskey) {
      toast(dict.noPasskeyForEmail);
      onNoPasskey(value);
      return;
    }
    const outcome = await signIn(() => Promise.resolve(found));
    if (outcome !== "signed-in") setIsSubmitting(false);
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (isSubmitting) return;
        // The field itself, not the state: autofill can fill it without a change event.
        const value = String(new FormData(e.currentTarget).get("email") ?? "").trim();
        if (value) void submit(value);
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Fingerprint className="size-4" />
          {dict.passkeyEmailTitle}
        </h2>
        <p className="text-sm text-muted-foreground leading-normal">{dict.passkeyEmailDescription}</p>
      </div>
      <div className="flex flex-col gap-2">
        <label htmlFor="passkey-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {dict.emailLabel}
        </label>
        <Input
          id="passkey-email"
          name="email"
          type="email"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={dict.emailPlaceholder}
          className="w-full h-9 bg-background/50 border-input"
          disabled={isSubmitting}
          required
        />
      </div>
      <Button
        type="submit"
        disabled={isSubmitting}
        className="w-full h-9 cursor-pointer font-semibold shadow-xs flex items-center justify-center gap-2"
      >
        {isSubmitting ? <Loader2 className="animate-spin size-4 text-primary-foreground" /> : <Fingerprint className="size-4" />}
        {dict.passkeyEmailSubmit}
      </Button>
      <Button type="button" variant="ghost" onClick={onBack} disabled={isSubmitting} className="w-full h-9 cursor-pointer gap-2">
        <ArrowLeft className="size-4" />
        {dict.passkeyEmailBack}
      </Button>
    </form>
  );
}
