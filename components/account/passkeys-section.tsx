"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, KeyRound, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { startRegistration } from "@simplewebauthn/browser";
import type { RegistrationResponseJSON } from "@simplewebauthn/browser";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Section } from "@/components/account/section";
import {
  beginPasskeyRegistrationAction,
  deletePasskey,
  finishPasskeyRegistrationAction,
  renamePasskey,
} from "@/lib/actions/account-actions";
import type { AccountDict } from "@/components/account/account-dict";
import { LocalDate } from "@/components/local-date";
import { tryCatch } from "@/lib/utils";

interface Passkey {
  id: string;
  name: string | null;
  deviceType: string | null;
  backedUp: boolean;
  createdAt: string;
  lastUsedAt: string | null;
}

type NameDialogState =
  | { mode: "add"; response: RegistrationResponseJSON; value: string }
  | { mode: "rename"; id: string; value: string };

export function PasskeysSection({
  passkeys,
  dict,
}: {
  passkeys: Passkey[];
  dict: AccountDict;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [nameDialog, setNameDialog] = useState<NameDialogState | null>(null);
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [optimisticPasskeys, applyOptimisticName] = useOptimistic(
    passkeys,
    (list, override: { id: string; name: string | null }) =>
      list.map((pk) =>
        pk.id === override.id ? { ...pk, name: override.name } : pk,
      ),
  );

  const handleAdd = async () => {
    setBusy(true);
    const [beginError, begin] = await tryCatch(beginPasskeyRegistrationAction());
    if (beginError || !begin || !begin.success || !begin.options) {
      setBusy(false);
      toast.error((!beginError && begin?.error) || dict.passkeyError);
      return;
    }

    const [regError, response] = await tryCatch(
      startRegistration({ optionsJSON: begin.options }),
    );
    setBusy(false);
    if (regError || !response) {
      const message =
        regError?.name === "InvalidStateError"
          ? dict.passkeyExists
          : regError?.name === "NotAllowedError"
            ? dict.passkeyCancelled
            : dict.passkeyError;
      toast.error(message);
      return;
    }
    setNameDialog({ mode: "add", response, value: "" });
  };

  const handleSubmitName = async () => {
    if (!nameDialog) return;
    const label = nameDialog.value.trim();

    if (nameDialog.mode === "rename") {
      const { id } = nameDialog;
      setNameDialog(null);
      startTransition(async () => {
        applyOptimisticName({ id, name: label || null });
        const [error, result] = await tryCatch(renamePasskey(id, label));
        if (error || !result || !result.success)
          toast.error(result?.error || dict.passkeyError);
        else router.refresh();
      });
      return;
    }

    setSaving(true);
    const [error, result] = await tryCatch(
      finishPasskeyRegistrationAction(nameDialog.response, label || undefined),
    );
    setSaving(false);
    if (error || !result || !result.success) {
      toast.error(result?.error || dict.passkeyError);
      return;
    }
    toast.success(dict.passkeyAdded);
    setNameDialog(null);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(dict.removeConfirm)) return;
    const result = await deletePasskey(id);
    if (result.success) {
      toast.success(dict.removed);
      router.refresh();
    } else toast.error(result.error || dict.passkeyError);
  };

  const isAdd = nameDialog?.mode === "add";

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
      {optimisticPasskeys.length === 0 ? (
        <p className="text-sm text-muted-foreground">{dict.noPasskeys}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {optimisticPasskeys.map((pk) => (
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
                onClick={() =>
                  setNameDialog({
                    mode: "rename",
                    id: pk.id,
                    value: pk.name ?? "",
                  })
                }
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
      {optimisticPasskeys.length === 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Fingerprint className="size-3.5" />
          {dict.passkeysHint}
        </p>
      )}

      <Dialog
        open={nameDialog !== null}
        onOpenChange={(open) => {
          if (saving) return;
          if (!open && !isAdd) setNameDialog(null);
        }}
      >
        <DialogContent
          className="sm:max-w-sm"
          showCloseButton={!isAdd}
          onInteractOutside={(e) => {
            if (isAdd) e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            if (isAdd) e.preventDefault();
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmitName();
            }}
          >
            <DialogHeader>
              <DialogTitle>{isAdd ? dict.addPasskey : dict.rename}</DialogTitle>
              <DialogDescription>{dict.namePrompt}</DialogDescription>
            </DialogHeader>
            <Input
              autoFocus
              value={nameDialog?.value ?? ""}
              onChange={(e) =>
                setNameDialog((prev) =>
                  prev ? { ...prev, value: e.target.value } : prev,
                )
              }
              placeholder={dict.namePlaceholder}
              maxLength={64}
              className="my-4 h-9"
            />
            <DialogFooter>
              {!isAdd && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={saving}
                  onClick={() => setNameDialog(null)}
                  className="cursor-pointer"
                >
                  {dict.cancel}
                </Button>
              )}
              <Button
                type="submit"
                size="sm"
                disabled={saving}
                className="cursor-pointer gap-1.5"
              >
                {saving && <Loader2 className="animate-spin size-4" />}
                {dict.save}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Section>
  );
}
