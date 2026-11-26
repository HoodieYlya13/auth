"use client";

import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmIdentity, StepLayout, useStepRunner, type ConfirmIdentityDict } from "@/components/account/confirm-identity";
import { requestAccountDeletion } from "@/lib/actions/account-deletion-actions";
import type { getDictionary } from "@/lib/dictionaries/dictionaries";

type DeleteAccountDict = Awaited<ReturnType<typeof getDictionary>>["deleteAccount"];

type Step = { kind: "confirm-identity" } | { kind: "final" } | { kind: "scheduled"; deletesOn: string };

/** Confirm it's you, confirm the deletion, then when it happens. */
export function DeleteAccountFlow({
  email,
  hasPasskey,
  locale,
  dict,
  identityDict,
}: {
  email: string;
  hasPasskey: boolean;
  locale: string;
  dict: DeleteAccountDict;
  identityDict: ConfirmIdentityDict;
}) {
  const [step, setStep] = useState<Step>({ kind: "confirm-identity" });
  const { busy, run } = useStepRunner(identityDict.error);

  async function deleteAccount() {
    const scheduled = await run("submit", () => requestAccountDeletion(locale));
    if (scheduled?.deletesOn) setStep({ kind: "scheduled", deletesOn: scheduled.deletesOn });
  }

  switch (step.kind) {
    case "confirm-identity":
      return <ConfirmIdentity email={email} hasPasskey={hasPasskey} locale={locale} onConfirmed={() => setStep({ kind: "final" })} dict={identityDict} />;
    case "final":
      return (
        <StepLayout title={dict.finalTitle} hint={dict.finalBody}>
          <Button type="button" variant="destructive" disabled={busy !== null} onClick={() => void deleteAccount()} className="h-9 w-full cursor-pointer gap-2">
            {busy === "submit" ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {dict.deleteButton}
          </Button>
        </StepLayout>
      );
    case "scheduled":
      return (
        <StepLayout
          title={dict.scheduledTitle}
          hint={dict.scheduledBody.replace("{date}", new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(new Date(step.deletesOn)))}
        >
          <Button asChild variant="outline" className="h-9 w-full">
            <a href={`/${locale}`}>{dict.home}</a>
          </Button>
        </StepLayout>
      );
  }
}
