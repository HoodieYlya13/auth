"use client";

import { useState } from "react";
import { Fingerprint, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { startAuthentication } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStateResetOnBack } from "@/components/use-state-reset-on-back";
import { beginIdentityPasskey, finishIdentityPasskey, sendIdentityCode, verifyIdentityCode } from "@/lib/actions/identity-actions";
import type { StepResult } from "@/lib/actions/sensitive-action-guards";
import type { getDictionary } from "@/lib/dictionaries/dictionaries";
import { tryCatch } from "@/lib/utils";

export type ConfirmIdentityDict = Awaited<ReturnType<typeof getDictionary>>["confirmIdentity"];

/** Which button spins while a step talks to the server. */
export type Busy = "passkey" | "code" | "submit" | null;

/** Runs a server step with its button spinning: its answer when it went through, else null, with its error in a toast and the button back. */
export function useStepRunner(fallbackError: string) {
  const [busy, setBusy] = useStateResetOnBack<Busy>(null);

  async function run<Result extends StepResult>(kind: Busy, action: () => Promise<Result>): Promise<Result | null> {
    setBusy(kind);
    const [error, result] = await tryCatch(action());
    if (!error && result.success) return result;
    setBusy(null);
    toast.error(result?.error || fallbackError);
    return null;
  }

  return { busy, setBusy, run };
}

/** Before a sensitive change: a passkey of this account, or a code sent to its address. */
export function ConfirmIdentity({
  email,
  hasPasskey,
  locale,
  onConfirmed,
  dict,
}: {
  email: string;
  hasPasskey: boolean;
  locale: string;
  onConfirmed: () => void;
  dict: ConfirmIdentityDict;
}) {
  const [isCodeSent, setIsCodeSent] = useState(false);
  const { busy, setBusy, run } = useStepRunner(dict.error);

  function confirmed() {
    setBusy(null);
    onConfirmed();
  }

  async function confirmWithPasskey() {
    setBusy("passkey");
    const [, begin] = await tryCatch(beginIdentityPasskey());
    if (!begin?.success || !begin.options || !begin.flowId) {
      setBusy(null);
      toast.error(begin?.error || dict.error);
      return;
    }
    const [promptError, assertion] = await tryCatch(startAuthentication({ optionsJSON: begin.options }));
    if (promptError || !assertion) {
      setBusy(null);
      toast.error(promptError?.name === "NotAllowedError" ? dict.passkeyCancelled : dict.error);
      return;
    }
    const flowId = begin.flowId;
    if (await run("passkey", () => finishIdentityPasskey(flowId, assertion))) confirmed();
  }

  async function sendCode() {
    if (!(await run("code", () => sendIdentityCode(locale)))) return;
    setBusy(null);
    setIsCodeSent(true);
  }

  if (isCodeSent) {
    return (
      <CodeStep
        title={dict.verifyTitle}
        hint={dict.codeSentTo.replace("{email}", email)}
        codeLabel={dict.codeLabel}
        submitLabel={dict.verify}
        isBusy={busy === "submit"}
        onSubmit={async (code) => {
          if (await run("submit", () => verifyIdentityCode(code))) confirmed();
        }}
      />
    );
  }

  return (
    <StepLayout title={dict.verifyTitle}>
      {hasPasskey && (
        <Button type="button" disabled={busy !== null} onClick={() => void confirmWithPasskey()} className="h-9 w-full cursor-pointer gap-2">
          {busy === "passkey" ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
          {dict.usePasskey}
        </Button>
      )}
      <Button
        type="button"
        variant={hasPasskey ? "outline" : "default"}
        disabled={busy !== null}
        onClick={() => void sendCode()}
        className="h-9 w-full cursor-pointer gap-2"
      >
        {busy === "code" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
        {dict.sendCode}
      </Button>
    </StepLayout>
  );
}

export function StepLayout({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="font-semibold">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground break-words">{hint}</p>}
      </div>
      {children}
    </div>
  );
}

const CODE_LENGTH = 6;

/** A 6-digit code from an email, sent as soon as it's complete. */
export function CodeStep({
  title,
  hint,
  codeLabel,
  submitLabel,
  isBusy,
  onSubmit,
  secondary,
}: {
  title: string;
  hint: string;
  codeLabel: string;
  submitLabel: string;
  isBusy: boolean;
  onSubmit: (code: string) => Promise<void>;
  secondary?: { label: string; onClick: () => void };
}) {
  const [code, setCode] = useState("");
  const submit = (value: string) => {
    if (isBusy || value.length !== CODE_LENGTH) return;
    void onSubmit(value).then(() => setCode(""));
  };

  return (
    <StepLayout title={title} hint={hint}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit(code);
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="account-code" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {codeLabel}
        </label>
        <Input
          id="account-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={CODE_LENGTH}
          autoFocus
          value={code}
          onChange={(event) => {
            const digits = event.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
            setCode(digits);
            // Six digits pasted or filled in from the email: no need to tap.
            if (digits.length === CODE_LENGTH) submit(digits);
          }}
          placeholder="000000"
          disabled={isBusy}
          className="h-11 w-full text-center font-mono text-xl tracking-[0.5em]"
        />
        <Button type="submit" disabled={isBusy || code.length !== CODE_LENGTH} className="h-9 w-full cursor-pointer gap-2">
          {isBusy && <Loader2 className="size-4 animate-spin" />}
          {submitLabel}
        </Button>
        {secondary && (
          <Button type="button" variant="ghost" disabled={isBusy} onClick={secondary.onClick} className="h-9 w-full cursor-pointer text-muted-foreground">
            {secondary.label}
          </Button>
        )}
      </form>
    </StepLayout>
  );
}
