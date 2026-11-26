"use client";

import { useState } from "react";
import { Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CodeStep, ConfirmIdentity, StepLayout, useStepRunner, type ConfirmIdentityDict } from "@/components/account/confirm-identity";
import { confirmNewEmail, sendNewEmailCode } from "@/lib/actions/email-change-actions";
import type { getDictionary } from "@/lib/dictionaries/dictionaries";

type EmailChangeDict = Awaited<ReturnType<typeof getDictionary>>["emailChange"];

type Step = { kind: "confirm-identity" } | { kind: "new-email" } | { kind: "confirm-new-email"; email: string };

/** Confirm it's you, then the new address and the code sent to it. */
export function EmailChangeFlow({
  currentEmail,
  hasPasskey,
  locale,
  dict,
  identityDict,
}: {
  currentEmail: string;
  hasPasskey: boolean;
  locale: string;
  dict: EmailChangeDict;
  identityDict: ConfirmIdentityDict;
}) {
  const [step, setStep] = useState<Step>({ kind: "confirm-identity" });
  const { busy, setBusy, run } = useStepRunner(identityDict.error);

  function goTo(next: Step) {
    setBusy(null);
    setStep(next);
  }

  async function confirm(code: string) {
    if (!(await run("submit", () => confirmNewEmail(code, locale)))) return;
    toast.success(dict.changed);
    window.location.assign(`/${locale}/account`);
  }

  switch (step.kind) {
    case "confirm-identity":
      return (
        <ConfirmIdentity email={currentEmail} hasPasskey={hasPasskey} locale={locale} onConfirmed={() => goTo({ kind: "new-email" })} dict={identityDict} />
      );
    case "new-email":
      return (
        <NewEmailStep
          isBusy={busy === "submit"}
          onSubmit={async (email) => {
            if (await run("submit", () => sendNewEmailCode(email, locale))) goTo({ kind: "confirm-new-email", email });
          }}
          dict={dict}
        />
      );
    case "confirm-new-email":
      return (
        <CodeStep
          title={dict.confirmTitle}
          hint={identityDict.codeSentTo.replace("{email}", step.email)}
          codeLabel={identityDict.codeLabel}
          submitLabel={dict.confirm}
          isBusy={busy === "submit"}
          onSubmit={confirm}
          secondary={{ label: dict.otherAddress, onClick: () => goTo({ kind: "new-email" }) }}
        />
      );
  }
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
