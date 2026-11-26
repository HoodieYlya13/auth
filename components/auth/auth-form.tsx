"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Turnstile } from "@/components/auth/turnstile";
import { toast } from "sonner";
import {
  authenticateMagicLink,
  beginPasskeyAuthenticationForEmail,
  verifyMagicCode,
  type PasskeyBeginResult,
} from "@/lib/actions/auth-actions";
import { PasskeyOffer } from "@/components/auth/passkey-offer";
import { usePasskeyAutofill, usePasskeySignIn, type PasskeyProgress } from "@/components/auth/use-passkey-sign-in";
import { ArrowLeft, Fingerprint, KeyRound, Mail, Loader2 } from "lucide-react";

import { useSearchParams } from "next/navigation";
import { tryCatch } from "@/lib/utils";
import { isAppSignIn } from "@/lib/redirect";
import { forgetSignInDraft, saveCodeRecipient, saveEmail, savedCodeRecipient, savedEmail } from "@/components/auth/sign-in-draft";
import { useStateResetOnBack } from "@/components/use-state-reset-on-back";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface AuthFormProps {
  locale: string;
  dict: {
    emailLabel: string;
    emailPlaceholder: string;
    sendMagicLink: string;
    magicLinkDescription: string;
    toastInitiatingMagicLink: string;
    toastSuccessMagicLink: string;
    toastErrorEmail: string;
    toastErrorSpam: string;
    toastErrorPasskey: string;
    codeTitle: string;
    codeDescription: string;
    codeLabel: string;
    codeSubmit: string;
    codeInvalid: string;
    codeOtherEmail: string;
    sendCode: string;
    sendCodeDescription: string;
    codeOnlyDescription: string;
    toastSuccessCode: string;
    passkeyOfferTitle: string;
    passkeyOfferDescription: string;
    usePasskey: string;
    sendCodeInstead: string;
    passkeyVerifying: string;
    passkeyCancel: string;
  };
}

function codeOnlyWording(dict: AuthFormProps["dict"]): AuthFormProps["dict"] {
  return {
    ...dict,
    sendMagicLink: dict.sendCode,
    magicLinkDescription: dict.sendCodeDescription,
    codeDescription: dict.codeOnlyDescription,
    toastSuccessMagicLink: dict.toastSuccessCode,
  };
}

export function AuthForm({ locale, dict: fullDict }: AuthFormProps) {
  const searchParams = useSearchParams();
  const returnTo = searchParams.get("return_to") ?? undefined;
  const dict = isAppSignIn(returnTo) ? codeOnlyWording(fullDict) : fullDict;
  const [email, setEmail] = useState(savedEmail);
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useStateResetOnBack(false);
  // Where the link and code just went: the form then asks for the code.
  const [sentTo, setSentTo] = useState<string | null>(savedCodeRecipient);
  useEffect(() => saveEmail(email), [email]);
  useEffect(() => saveCodeRecipient(sentTo), [sentTo]);

  const honeypotRef = useRef<HTMLInputElement>(null);
  const renderedAtRef = useRef<number>(0);

  useEffect(() => {
    renderedAtRef.current = Date.now();
  }, []);

  // Bot checks only guard the email flow: a passkey needs a user-verified
  // WebAuthn signature, which a form-filling bot can't produce.
  const validateMagicLink = (email: string): boolean => {
    if (honeypotRef.current?.value) {
      toast.error(dict.toastErrorSpam);
      return false;
    }

    const elapsedMs = Date.now() - renderedAtRef.current;
    if (elapsedMs < 1200) {
      toast.error(dict.toastErrorSpam);
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error(dict.toastErrorEmail);
      return false;
    }

    return true;
  };

  // The passkey answered: the form gives way to the sign-in under way, until the next page opens.
  const [isVerifyingPasskey, setIsVerifyingPasskey] = useStateResetOnBack(false);
  const isPasskeySignInCancelled = useRef(false);
  const passkeyProgress: PasskeyProgress = {
    onVerifying: () => {
      isPasskeySignInCancelled.current = false;
      setIsVerifyingPasskey(true);
    },
    onFailed: () => setIsVerifyingPasskey(false),
    isCancelled: () => isPasskeySignInCancelled.current,
  };
  const cancelPasskeySignIn = () => {
    isPasskeySignInCancelled.current = true;
    setIsVerifyingPasskey(false);
  };
  const signInWithPasskey = usePasskeySignIn({ locale, returnTo }, dict, passkeyProgress);
  // This device's passkeys show in the email field's autofill: picking one signs in.
  usePasskeyAutofill({ locale, returnTo }, dict, passkeyProgress);
  // A code was asked for an account that has a passkey: offered first (see PasskeyOffer).
  const [passkeyOffer, setPasskeyOffer] = useState<{ email: string; prompt: PasskeyBeginResult } | null>(null);

  const handleEmailSubmit = async (email: string) => {
    if (!validateMagicLink(email)) return;
    setIsSubmitting(true);
    const [, found] = await tryCatch(beginPasskeyAuthenticationForEmail(email));
    if (found?.success && found.hasPasskey) {
      setIsSubmitting(false);
      setPasskeyOffer({ email, prompt: found });
      return;
    }
    await sendCode(email);
  };

  const sendCode = async (email: string) => {
    setIsSubmitting(true);
    const toastId = toast.loading(dict.toastInitiatingMagicLink);
    const elapsedMs = Date.now() - renderedAtRef.current;

    const result = await authenticateMagicLink({
      email,
      elapsedMs,
      captchaToken: turnstileToken || undefined,
      locale,
      returnTo,
    });

    if (result.success) {
      toast.success(dict.toastSuccessMagicLink, { id: toastId });
      setSentTo(email);
      setEmail("");
      setTurnstileToken(null);
      setShowCaptcha(false);
    } else {
      if (result.requiresCaptcha) {
        setShowCaptcha(true);
        setTurnstileToken(null);
      }
      toast.error(result.error || "Failed to send magic link", { id: toastId });
    }

    setIsSubmitting(false);
  };

  if (isVerifyingPasskey) return <PasskeyVerifying label={dict.passkeyVerifying} cancelLabel={dict.passkeyCancel} onCancel={cancelPasskeySignIn} />;

  if (sentTo)
    return <CodeSection email={sentTo} onBack={() => setSentTo(null)} dict={dict} />;

  if (passkeyOffer)
    return (
      <PasskeyOffer
        email={passkeyOffer.email}
        passkeyPrompt={passkeyOffer.prompt}
        signIn={signInWithPasskey}
        onSendCode={() => {
          setPasskeyOffer(null);
          setEmail(passkeyOffer.email);
          void sendCode(passkeyOffer.email);
        }}
        onBack={() => setPasskeyOffer(null)}
        dict={dict}
      />
    );

  return (
    <div className="flex flex-col gap-5">
      <Honeypot honeypotRef={honeypotRef} />
      <MagicLinkSection
        email={email}
        setEmail={setEmail}
        isSubmitting={isSubmitting}
        showCaptcha={showCaptcha}
        turnstileToken={turnstileToken}
        setTurnstileToken={setTurnstileToken}
        setShowCaptcha={setShowCaptcha}
        onSubmit={handleEmailSubmit}
        dict={dict}
      />
    </div>
  );
}

/** A fingerprint with a ring sweeping around it, while the server checks the passkey and the next page loads; or back to the form. */
function PasskeyVerifying({ label, cancelLabel, onCancel }: { label: string; cancelLabel: string; onCancel: () => void }) {
  return (
    <div className="flex flex-col items-center gap-8 pt-8 pb-2 animate-in fade-in zoom-in-95 duration-300">
      <div className="relative grid size-20 place-items-center">
        {/* Inset: the pulse grows to twice its size and must stay clear of the caption. */}
        <span aria-hidden className="absolute inset-3 rounded-full bg-primary/10 animate-ping [animation-duration:1.6s]" />
        <span aria-hidden className="absolute inset-0 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        <Fingerprint aria-hidden className="size-9 text-primary animate-pulse" />
      </div>
      <p role="status" className="text-sm font-medium text-muted-foreground">{label}</p>
      <Button
        type="button"
        variant="ghost"
        onClick={onCancel}
        className="w-full h-9 cursor-pointer text-muted-foreground flex items-center justify-center gap-2"
      >
        <ArrowLeft className="size-4" />
        {cancelLabel}
      </Button>
    </div>
  );
}

function Honeypot({
  honeypotRef,
}: {
  honeypotRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        left: "-9999px",
        top: 0,
        width: 1,
        height: 1,
        overflow: "hidden",
      }}
    >
      <label htmlFor="website">Website</label>
      <input
        ref={honeypotRef}
        id="website"
        name="website"
        type="text"
        tabIndex={-1}
        autoComplete="off"
        defaultValue=""
      />
    </div>
  );
}

function MagicLinkSection({
  email,
  setEmail,
  isSubmitting,
  showCaptcha,
  turnstileToken,
  setTurnstileToken,
  setShowCaptcha,
  onSubmit,
  dict,
}: {
  email: string;
  setEmail: (email: string) => void;
  isSubmitting: boolean;
  showCaptcha: boolean;
  turnstileToken: string | null;
  setTurnstileToken: (token: string | null) => void;
  setShowCaptcha: (show: boolean) => void;
  onSubmit: (email: string) => void;
  dict: AuthFormProps["dict"];
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if ((showCaptcha && !turnstileToken) || isSubmitting) return;
        // The field itself, not the state: autofill and password managers can
        // fill it without a change event.
        const value = String(
          new FormData(e.currentTarget).get("email") ?? "",
        ).trim();
        setEmail(value);
        onSubmit(value);
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label
          htmlFor="email"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {dict.emailLabel}
        </label>
        <Input
          id="email"
          autoCorrect="off"
          spellCheck={false}
          name="email"
          type="email"
          // "webauthn": this device's passkeys show up in the autofill (see usePasskeyAutofill).
          autoComplete="email webauthn"
          // Focused at once: some desktop browsers then show the passkey suggestion without a click.
          autoFocus
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setTurnstileToken(null);
            setShowCaptcha(false);
          }}
          placeholder={dict.emailPlaceholder}
          className="w-full h-9 bg-background/50 border-input"
          disabled={isSubmitting}
          required
        />
      </div>

      {showCaptcha && TURNSTILE_SITE_KEY && (
        <div className="flex justify-center min-h-[65px] items-center animate-in fade-in slide-in-from-top-2 duration-300">
          <Turnstile
            siteKey={TURNSTILE_SITE_KEY}
            onVerify={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
            theme="auto"
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          type="submit"
          // Never disabled for an invalid email: a disabled submit button
          // stops Enter from submitting. The email is checked on submit.
          disabled={(showCaptcha && !turnstileToken) || isSubmitting}
          className="w-full h-9 cursor-pointer font-semibold shadow-xs border-input hover:bg-accent flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <Loader2 className="animate-spin size-4 text-muted-foreground" />
          ) : (
            <Mail className="size-4" />
          )}
          {dict.sendMagicLink}
        </Button>
        <p className="text-[11px] text-muted-foreground leading-normal px-0.5">
          {dict.magicLinkDescription}
        </p>
      </div>
    </form>
  );
}

/** After the email: open the link, or type its code here and stay on this page. */
function CodeSection({
  email,
  onBack,
  dict,
}: {
  email: string;
  onBack: () => void;
  dict: AuthFormProps["dict"];
}) {
  const [code, setCode] = useState("");
  const [isSubmitting, setIsSubmitting] = useStateResetOnBack(false);

  const submit = async (value: string) => {
    if (isSubmitting || value.length !== 6) return;
    setIsSubmitting(true);
    const [error, result] = await tryCatch(verifyMagicCode(email, value));
    if (!error && result?.success && result.redirectTo) {
      forgetSignInDraft();
      window.location.href = result.redirectTo;
      return;
    }
    setIsSubmitting(false);
    setCode("");
    toast.error(
      result?.error && result.error !== "invalid_code"
        ? result.error
        : dict.codeInvalid,
    );
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit(code);
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-1.5">
        <h2 className="flex items-center gap-2 font-semibold">
          <Mail className="size-4" />
          {dict.codeTitle}
        </h2>
        <p className="text-sm text-muted-foreground leading-normal break-words">
          {dict.codeDescription.replace("{email}", email)}
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <label
          htmlFor="code"
          className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
        >
          {dict.codeLabel}
        </label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          autoFocus
          value={code}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
            setCode(digits);
            // Six digits pasted or filled in from the email: no need to tap.
            if (digits.length === 6) void submit(digits);
          }}
          placeholder="000000"
          className="w-full h-11 bg-background/50 border-input text-center font-mono text-xl tracking-[0.5em]"
          disabled={isSubmitting}
          required
        />
      </div>
      <Button
        type="submit"
        disabled={isSubmitting || code.length !== 6}
        className="w-full h-9 cursor-pointer font-semibold shadow-xs flex items-center justify-center gap-2"
      >
        {isSubmitting ? (
          <Loader2 className="animate-spin size-4 text-primary-foreground" />
        ) : (
          <KeyRound className="size-4" />
        )}
        {dict.codeSubmit}
      </Button>
      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={isSubmitting}
        className="w-full h-9 cursor-pointer text-muted-foreground flex items-center justify-center gap-2"
      >
        <ArrowLeft className="size-4" />
        {dict.codeOtherEmail}
      </Button>
    </form>
  );
}
