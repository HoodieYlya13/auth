"use client";

import { useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/actions/account-actions";

export function SignOutButton({
  locale,
  label,
}: {
  locale: string;
  label: string;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Button
      type="button"
      variant="outline"
      disabled={busy}
      onClick={() => {
        setBusy(true);
        void signOut(locale);
      }}
      className="h-9 cursor-pointer gap-1.5"
    >
      <LogOut className="size-4" />
      {label}
    </Button>
  );
}
