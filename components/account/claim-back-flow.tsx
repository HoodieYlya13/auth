"use client";

import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StepLayout, useStepRunner } from "@/components/account/confirm-identity";
import { claimAccountBack } from "@/lib/actions/email-claim-back-actions";
import type { getDictionary } from "@/lib/dictionaries/dictionaries";

type ClaimBackDict = Awaited<ReturnType<typeof getDictionary>>["claimBack"];

/** Confirms on a button, never on opening the link: mail scanners open links too. */
export function ClaimBackFlow({ token, formerEmail, locale, dict }: { token: string; formerEmail: string; locale: string; dict: ClaimBackDict }) {
  const [isClaimedBack, setIsClaimedBack] = useState(false);
  const { busy, run } = useStepRunner(dict.error);

  async function claimBack() {
    if (await run("submit", () => claimAccountBack(token, locale))) setIsClaimedBack(true);
  }

  if (isClaimedBack) {
    return (
      <StepLayout title={dict.doneTitle} hint={dict.doneBody.replace("{email}", formerEmail)}>
        <Button asChild className="h-9 w-full">
          <a href={`/${locale}`}>{dict.signIn}</a>
        </Button>
      </StepLayout>
    );
  }
  return (
    <StepLayout title={dict.confirmTitle.replace("{email}", formerEmail)} hint={dict.confirmBody}>
      <Button type="button" variant="destructive" disabled={busy !== null} onClick={() => void claimBack()} className="h-9 w-full cursor-pointer gap-2">
        {busy === "submit" ? <Loader2 className="size-4 animate-spin" /> : <ShieldCheck className="size-4" />}
        {dict.confirmButton}
      </Button>
    </StepLayout>
  );
}
