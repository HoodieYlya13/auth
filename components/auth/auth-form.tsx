"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Turnstile } from "@/components/auth/turnstile";
import { toast } from "sonner";
import {
  authenticatePasskey,
  authenticateMagicLink,
} from "@/lib/actions/auth-actions";
import { Fingerprint, Mail, Loader2 } from "lucide-react";

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

interface AuthFormProps {
  dict: {
    emailLabel: string;
    emailPlaceholder: string;
    continuePasskey: string;
    sendMagicLink: string;
    passkeyDescription: string;
    magicLinkDescription: string;
    orDivider: string;
    toastInitiatingPasskey: string;
    toastInitiatingMagicLink: string;
    toastSuccessPasskey: string;
    toastSuccessMagicLink: string;
    toastErrorEmail: string;
    toastErrorSpam: string;
  };
}

export function AuthForm({ dict }: AuthFormProps) {
  const [email, setEmail] = useState("");
  const [showCaptcha, setShowCaptcha] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeAction, setActiveAction] = useState<
    "passkey" | "magic-link" | null
  >(null);

  const honeypotRef = useRef<HTMLInputElement>(null);
  const renderedAtRef = useRef<number>(0);

  useEffect(() => {
    renderedAtRef.current = Date.now();
  }, []);

  const validateRequest = (action: "passkey" | "magic-link"): boolean => {
    if (honeypotRef.current?.value) {
      toast.error(dict.toastErrorSpam);
      return false;
    }

    const elapsedMs = Date.now() - renderedAtRef.current;
    if (elapsedMs < 1200) {
      toast.error(dict.toastErrorSpam);
      return false;
    }

    if (action === "magic-link") {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast.error(dict.toastErrorEmail);
        return false;
      }
    }

    return true;
  };

  const handlePasskey = async () => {
    if (!validateRequest("passkey")) return;
    setIsSubmitting(true);
    setActiveAction("passkey");

    const toastId = toast.loading(dict.toastInitiatingPasskey);
    const result = await authenticatePasskey();

    if (result.success)
      toast.success(dict.toastSuccessPasskey, { id: toastId });
    else toast.error(result.error || "Authentication failed", { id: toastId });

    setIsSubmitting(false);
    setActiveAction(null);
  };

  const handleMagicLink = async () => {
    if (!validateRequest("magic-link")) return;
    setIsSubmitting(true);
    setActiveAction("magic-link");

    const toastId = toast.loading(dict.toastInitiatingMagicLink);
    const elapsedMs = Date.now() - renderedAtRef.current;

    const result = await authenticateMagicLink({
      email,
      elapsedMs,
      captchaToken: turnstileToken || undefined,
    });

    if (result.success) {
      toast.success(dict.toastSuccessMagicLink, { id: toastId });
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
    setActiveAction(null);
  };

  const isEmailValid = email.includes("@") && email.length > 4;

  return (
    <div className="flex flex-col gap-5">
      <Honeypot honeypotRef={honeypotRef} />

      <PasskeySection
        isSubmitting={isSubmitting}
        activeAction={activeAction}
        onPasskey={handlePasskey}
        dict={dict}
      />

      <div className="relative flex items-center justify-center py-1">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-border"></span>
        </div>
        <span className="relative bg-card px-3 text-xs uppercase text-muted-foreground font-medium">
          {dict.orDivider}
        </span>
      </div>

      <MagicLinkSection
        email={email}
        setEmail={setEmail}
        isSubmitting={isSubmitting}
        activeAction={activeAction}
        showCaptcha={showCaptcha}
        turnstileToken={turnstileToken}
        setTurnstileToken={setTurnstileToken}
        setShowCaptcha={setShowCaptcha}
        onSubmit={handleMagicLink}
        isEmailValid={isEmailValid}
        dict={dict}
      />
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

function PasskeySection({
  isSubmitting,
  activeAction,
  onPasskey,
  dict,
}: {
  isSubmitting: boolean;
  activeAction: "passkey" | "magic-link" | null;
  onPasskey: () => void;
  dict: AuthFormProps["dict"];
}) {
  return (
    <div className="flex flex-col gap-2">
      <Button
        type="button"
        disabled={isSubmitting}
        onClick={onPasskey}
        className="w-full h-9 cursor-pointer font-semibold shadow-xs flex items-center justify-center gap-2"
      >
        {isSubmitting && activeAction === "passkey" ? (
          <Loader2 className="animate-spin size-4 text-primary-foreground" />
        ) : (
          <Fingerprint className="size-4" />
        )}
        {dict.continuePasskey}
      </Button>
      <p className="text-[11px] text-muted-foreground leading-normal px-0.5">
        {dict.passkeyDescription}
      </p>
    </div>
  );
}

function MagicLinkSection({
  email,
  setEmail,
  isSubmitting,
  activeAction,
  showCaptcha,
  turnstileToken,
  setTurnstileToken,
  setShowCaptcha,
  onSubmit,
  isEmailValid,
  dict,
}: {
  email: string;
  setEmail: (email: string) => void;
  isSubmitting: boolean;
  activeAction: "passkey" | "magic-link" | null;
  showCaptcha: boolean;
  turnstileToken: string | null;
  setTurnstileToken: (token: string | null) => void;
  setShowCaptcha: (show: boolean) => void;
  onSubmit: () => void;
  isEmailValid: boolean;
  dict: AuthFormProps["dict"];
}) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (
          isEmailValid &&
          !(showCaptcha && !turnstileToken) &&
          !isSubmitting
        ) {
          onSubmit();
        }
      }}
      className="flex flex-col gap-5"
    >
      <div className="flex flex-col gap-2">
        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {dict.emailLabel}
        </label>
        <Input
          type="email"
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
          disabled={
            !isEmailValid || (showCaptcha && !turnstileToken) || isSubmitting
          }
          className="w-full h-9 cursor-pointer font-semibold shadow-xs border-input hover:bg-accent flex items-center justify-center gap-2"
        >
          {isSubmitting && activeAction === "magic-link" ? (
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
