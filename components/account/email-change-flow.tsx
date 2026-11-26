"use client";

import { useState } from "react";
import { Fingerprint, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { startAuthentication } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useStateResetOnBack } from "@/components/use-state-reset-on-back";
import {
  beginEmailChangePasskey,
  confirmNewEmail,
  finishEmailChangePasskey,
  sendCurrentEmailCode,
  sendNewEmailCode,
  verifyCurrentEmailCode,
  type EmailChangeResult,
} from "@/lib/actions/email-change-actions";
import type { getDictionary } from "@/lib/dictionaries/dictionaries";
import { tryCatch } from "@/lib/utils";

type EmailChangeDict = Awaited<ReturnType<typeof getDictionary>>["emailChange"];

type Step =
  | { kind: "verify" }
  | { kind: "verify-code" }
  | { kind: "new-email" }
  | { kind: "confirm"; email: string };

type Busy = "passkey" | "code" | "submit" | null;

/** Confirm it's you (passkey, or a code to the current address), then the new address and its code. */
export function EmailChangeFlow({
  currentEmail,
  hasPasskey,
  locale,
  dict,
}: {
  currentEmail: string;
  hasPasskey: boolean;
  locale: string;
  dict: EmailChangeDict;
}) {
  const [step, setStep] = useState<Step>({ kind: "verify" });
  const [busy, setBusy] = useStateResetOnBack<Busy>(null);

  /** Runs one server call with its button spinning; true when it went through, else its error in a toast. */
  async function run(kind: Busy, action: () => Promise<EmailChangeResult>): Promise<boolean> {
    setBusy(kind);
    const [error, result] = await tryCatch(action());
    const isDone = !error && result.success;
    if (!isDone) {
      setBusy(null);
      toast.error(result?.error || dict.error);
    }
    return isDone;
  }

  async function verifyWithPasskey() {
    setBusy("passkey");
    const [, begin] = await tryCatch(beginEmailChangePasskey());
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
    if (await run("passkey", () => finishEmailChangePasskey(flowId, assertion))) goTo({ kind: "new-email" });
  }

  function goTo(next: Step) {
    setBusy(null);
    setStep(next);
  }

  async function finish(code: string) {
    if (!(await run("submit", () => confirmNewEmail(code, locale)))) return;
    toast.success(dict.changed);
    window.location.assign(`/${locale}/account`);
  }

  switch (step.kind) {
    case "verify":
      return (
        <StepLayout title={dict.verifyTitle}>
          {hasPasskey && (
            <Button type="button" disabled={busy !== null} onClick={() => void verifyWithPasskey()} className="h-9 w-full cursor-pointer gap-2">
              {busy === "passkey" ? <Loader2 className="size-4 animate-spin" /> : <Fingerprint className="size-4" />}
              {dict.usePasskey}
            </Button>
          )}
          <Button
            type="button"
            variant={hasPasskey ? "outline" : "default"}
            disabled={busy !== null}
            onClick={async () => {
              if (await run("code", () => sendCurrentEmailCode(locale))) goTo({ kind: "verify-code" });
            }}
            className="h-9 w-full cursor-pointer gap-2"
          >
            {busy === "code" ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
            {dict.sendCode}
          </Button>
        </StepLayout>
      );
    case "verify-code":
      return (
        <CodeStep
          title={dict.verifyTitle}
          hint={dict.codeSentTo.replace("{email}", currentEmail)}
          submitLabel={dict.verify}
          isBusy={busy === "submit"}
          onSubmit={async (code) => {
            if (await run("submit", () => verifyCurrentEmailCode(code))) goTo({ kind: "new-email" });
          }}
          dict={dict}
        />
      );
    case "new-email":
      return (
        <NewEmailStep
          isBusy={busy === "submit"}
          onSubmit={async (email) => {
            if (await run("submit", () => sendNewEmailCode(email, locale))) goTo({ kind: "confirm", email });
          }}
          dict={dict}
        />
      );
    case "confirm":
      return (
        <CodeStep
          title={dict.confirmTitle}
          hint={dict.codeSentTo.replace("{email}", step.email)}
          submitLabel={dict.confirm}
          isBusy={busy === "submit"}
          onSubmit={finish}
          secondary={{ label: dict.otherAddress, onClick: () => goTo({ kind: "new-email" }) }}
          dict={dict}
        />
      );
  }
}

function StepLayout({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
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

function CodeStep({
  title,
  hint,
  submitLabel,
  isBusy,
  onSubmit,
  secondary,
  dict,
}: {
  title: string;
  hint: string;
  submitLabel: string;
  isBusy: boolean;
  onSubmit: (code: string) => Promise<void>;
  secondary?: { label: string; onClick: () => void };
  dict: EmailChangeDict;
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
        <label htmlFor="email-change-code" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {dict.codeLabel}
        </label>
        <Input
          id="email-change-code"
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

function NewEmailStep({ isBusy, onSubmit, dict }: { isBusy: boolean; onSubmit: (email: string) => Promise<void>; dict: EmailChangeDict }) {
  const [email, setEmail] = useState("");
  return (
    <StepLayout title={dict.newEmailTitle}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (!isBusy && email.trim()) void onSubmit(email.trim());
        }}
        className="flex flex-col gap-3"
      >
        <label htmlFor="new-email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {dict.newEmailLabel}
        </label>
        <Input
          id="new-email"
          type="email"
          autoComplete="email"
          autoCorrect="off"
          spellCheck={false}
          autoFocus
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          disabled={isBusy}
          className="h-9 w-full"
        />
        <Button type="submit" disabled={isBusy || !email.trim()} className="h-9 w-full cursor-pointer gap-2">
          {isBusy ? <Loader2 className="size-4 animate-spin" /> : <Mail className="size-4" />}
          {dict.sendNewCode}
        </Button>
      </form>
    </StepLayout>
  );
}
