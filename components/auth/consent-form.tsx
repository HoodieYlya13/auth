"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { approveConsent, denyConsent } from "@/lib/actions/oidc-actions";

interface ConsentDict {
  approve: string;
  deny: string;
  scopesTitle: string;
  scopeOpenid: string;
  scopeProfile: string;
  scopeEmail: string;
  scopeOffline: string;
  error: string;
}

const SCOPE_KEYS: Record<string, keyof ConsentDict> = {
  openid: "scopeOpenid",
  profile: "scopeProfile",
  email: "scopeEmail",
  offline_access: "scopeOffline",
};

export function ConsentForm({
  returnTo,
  email,
  scopes,
  dict,
}: {
  returnTo: string;
  email: string;
  scopes: string[];
  dict: ConsentDict;
}) {
  const [busy, setBusy] = useState<"approve" | "deny" | null>(null);

  const run = async (
    kind: "approve" | "deny",
    action: typeof approveConsent,
  ) => {
    setBusy(kind);
    const result = await action(returnTo);
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
        <p className="text-xs text-muted-foreground">{email}</p>
      </div>

      <div className="flex flex-col gap-2">
        <Button
          type="button"
          disabled={busy !== null}
          onClick={() => run("approve", approveConsent)}
          className="w-full h-9 cursor-pointer font-semibold shadow-xs flex items-center justify-center gap-2"
        >
          {busy === "approve" && <Loader2 className="animate-spin size-4" />}
          {dict.approve}
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
