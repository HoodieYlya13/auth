"use client";

import { Fingerprint, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import {
  beginPasskeyRegistrationAction,
  finishPasskeyRegistrationAction,
} from "@/lib/actions/account-actions";
import { tryCatch } from "@/lib/utils";
import { useStateResetOnBack } from "@/components/use-state-reset-on-back";

interface PasskeyPromptDict {
  add: string;
  skip: string;
  added: string;
  error: string;
  cancelled: string;
  exists: string;
}

/** Add a passkey, or go on without one. Either way ends at `next`. */
export function PasskeyPrompt({
  next,
  locale,
  dict,
}: {
  next: string;
  locale: string;
  dict: PasskeyPromptDict;
}) {
  const [busy, setBusy] = useStateResetOnBack(false);
  const goOn = () => {
    window.location.href = next;
  };

  const handleAdd = async () => {
    setBusy(true);
    const [beginError, begin] = await tryCatch(beginPasskeyRegistrationAction());
    if (beginError || !begin?.success || !begin.options) {
      setBusy(false);
      toast.error(dict.error);
      return;
    }

    const [regError, response] = await tryCatch(
      startRegistration({ optionsJSON: begin.options }),
    );
    if (regError || !response) {
      setBusy(false);
      // Cancelled: stay, so they can try again or skip.
      toast.error(
        regError?.name === "InvalidStateError"
          ? dict.exists
          : regError?.name === "NotAllowedError"
            ? dict.cancelled
            : dict.error,
      );
      return;
    }

    // Unnamed: it shows as the device type, and can be renamed from the account page.
    const [finishError, result] = await tryCatch(
      finishPasskeyRegistrationAction(response, locale),
    );
    if (finishError || !result?.success) {
      setBusy(false);
      toast.error(dict.error);
      return;
    }
    toast.success(dict.added);
    goOn();
  };

  return (
    <div className="flex flex-col gap-3">
      <Button
        type="button"
        disabled={busy}
        onClick={handleAdd}
        className="w-full h-9 cursor-pointer font-semibold shadow-xs flex items-center justify-center gap-2"
      >
        {busy ? (
          <Loader2 className="animate-spin size-4" />
        ) : (
          <Fingerprint className="size-4" />
        )}
        {dict.add}
      </Button>
      <Button
        type="button"
        variant="ghost"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          goOn();
        }}
        className="w-full h-9 cursor-pointer"
      >
        {dict.skip}
      </Button>
    </div>
  );
}
