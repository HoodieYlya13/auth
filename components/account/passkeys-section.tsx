"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Section } from "@/components/account/section";
import {
  beginPasskeyRegistrationAction,
  deletePasskey,
  finishPasskeyRegistrationAction,
  renamePasskey,
} from "@/lib/actions/account-actions";
import type { AccountDict } from "@/components/account/account-dict";
import { LocalDate } from "@/components/local-date";

interface Passkey {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

export function PasskeysSection({
  passkeys,
  dict,
}: {
  passkeys: Passkey[];
  dict: AccountDict;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    setBusy(true);
    try {
      const begin = await beginPasskeyRegistrationAction();
      if (!begin.success || !begin.options) {
        toast.error(begin.error || dict.passkeyError);
        return;
      }
      const response = await startRegistration({ optionsJSON: begin.options });
      const label = window.prompt(dict.namePrompt) ?? undefined;
      const result = await finishPasskeyRegistrationAction(response, label);
      if (result.success) {
        toast.success(dict.passkeyAdded);
        router.refresh();
      } else toast.error(result.error || dict.passkeyError);
    } catch {
      toast.error(dict.passkeyError);
    } finally {
      setBusy(false);
    }
  };

  const handleRename = async (id: string, current: string | null) => {
    const name = window.prompt(dict.namePrompt, current ?? "");
    if (name === null) return;
    const result = await renamePasskey(id, name);
    if (result.success) router.refresh();
    else toast.error(result.error || dict.passkeyError);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(dict.removeConfirm)) return;
    const result = await deletePasskey(id);
    if (result.success) {
      toast.success(dict.removed);
      router.refresh();
    } else toast.error(result.error || dict.passkeyError);
  };

  return (
    <Section
      title={dict.passkeysTitle}
      description={dict.passkeysDescription}
      action={
        <Button
          type="button"
          size="sm"
          disabled={busy}
          onClick={handleAdd}
          className="h-8 cursor-pointer gap-1.5"
        >
          {busy ? (
            <Loader2 className="animate-spin size-4" />
          ) : (
            <Plus className="size-4" />
          )}
          {dict.addPasskey}
        </Button>
      }
    >
      {passkeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noPasskeys}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {passkeys.map((pk) => (
            <li key={pk.id} className="flex items-center gap-3 py-3">
              <KeyRound className="size-4 text-muted-foreground shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {pk.name || dict.unnamedPasskey}
                </p>
                <p className="text-xs text-muted-foreground">
                  {dict.added} <LocalDate date={pk.createdAt} />
                  {" · "}
                  {dict.lastUsed}{" "}
                  {pk.lastUsedAt ? (
                    <LocalDate date={pk.lastUsedAt} />
                  ) : (
                    dict.never
                  )}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleRename(pk.id, pk.name)}
                className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer"
              >
                {dict.rename}
              </button>
              <button
                type="button"
                onClick={() => handleDelete(pk.id)}
                aria-label={dict.remove}
                className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {passkeys.length === 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Fingerprint className="size-3.5" />
          {dict.passkeysHint}
        </p>
      )}
    </Section>
  );
}
