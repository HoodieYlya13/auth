"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  approveConsent,
  denyConsent,
  switchAccount,
} from "@/lib/actions/oidc-actions";

interface ConsentDict {
  approve: string;
  deny: string;
  switchAccount: string;
  scopesTitle: string;
  scopeOpenid: string;
  scopePublicProfile: string;
  scopeProfile: string;
  scopeEmail: string;
  scopeOffline: string;
  error: string;
}

const SCOPE_KEYS: Record<string, keyof ConsentDict> = {
  openid: "scopeOpenid",
  public_profile: "scopePublicProfile",
  profile: "scopeProfile",
  email: "scopeEmail",
  offline_access: "scopeOffline",
};

interface Account {
  username: string | null;
  email: string;
}

type ConsentChoice = "approve" | "deny" | "switch";

export function ConsentForm({
  returnTo,
  locale,
  account,
  scopes,
  approveLabel,
  dict,
}: {
  returnTo: string;
  locale: string;
  account: Account;
  scopes: string[];
  approveLabel: string;
  dict: ConsentDict;
}) {
  const [busy, setBusy] = useState<ConsentChoice | null>(null);

  const run = async (
    kind: ConsentChoice,
    action: (returnTo: string, locale: string) => ReturnType<typeof approveConsent>,
  ) => {
    setBusy(kind);
    const result = await action(returnTo, locale);
    if (result.success && result.redirectTo) {
      window.location.href = result.redirectTo;
      return;
    }
    toast.error(result.error || dict.error);
    setBusy(null);
  };

  const labelled = scopes
    .map((s) => SCOPE_KEYS[s])
    .filter((k): k is keyof ConsentDict => Boolean(k));

  return (
    <div className="flex flex-col gap-6">
      {labelled.length > 0 && (
        <div className="flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {dict.scopesTitle}
          </p>
          <ul className="flex flex-col gap-2">
            {labelled.map((key) => (
              <li key={key} className="flex items-center gap-2 text-sm">
                <Check className="size-4 text-primary shrink-0" />
                <span>{dict[key]}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2.5">
        <div className="min-w-0">
          {account.username && (
            <p className="truncate text-sm font-medium">{account.username}</p>
          )}
          <p className="truncate text-xs text-muted-foreground">{account.email}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          disabled={busy !== null}
          onClick={() => run("switch", switchAccount)}
          className="h-8 shrink-0 cursor-pointer gap-2 text-xs"
        >
          {busy === "switch" && <Loader2 className="animate-spin size-3.5" />}
          {dict.switchAccount}
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          disabled={busy !== null}
          onClick={() => run("approve", approveConsent)}
          className="w-full h-9 cursor-pointer font-semibold shadow-xs flex items-center justify-center gap-2"
        >
          {busy === "approve" && <Loader2 className="animate-spin size-4" />}
          {approveLabel}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={busy !== null}
          onClick={() => run("deny", denyConsent)}
          className="w-full h-9 cursor-pointer font-semibold border-input hover:bg-accent flex items-center justify-center gap-2"
        >
          {busy === "deny" && <Loader2 className="animate-spin size-4" />}
          {dict.deny}
        </Button>
      </div>
    </div>
  );
}
