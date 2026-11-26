"use client";

import { Loader2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/account-actions";
import { useStateResetOnBack } from "@/components/use-state-reset-on-back";

export function SignOutButton({
  locale,
  clientId,
  label,
}: {
  locale: string;
  clientId?: string;
  label: string;
}) {
  const [busy, setBusy] = useStateResetOnBack(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy}
      aria-busy={busy}
      onClick={() => {
        setBusy(true);
        // Redirects on success; a network error gives the button back.
        signOut(locale, clientId).catch(() => setBusy(false));
      }}
      className="h-9 cursor-pointer gap-1.5"
    >
      {busy ? <Loader2 className="size-4 animate-spin" /> : <LogOut className="size-4" />}
      {label}
    </Button>
  );
}
