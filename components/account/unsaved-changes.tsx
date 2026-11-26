"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { AccountDict } from "@/components/account/account-dict";

const opensElsewhere = (event: MouseEvent) =>
  event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey;

/** The link a click follows in this tab, if any. */
function followedLink(event: MouseEvent): HTMLAnchorElement | null {
  if (event.defaultPrevented || opensElsewhere(event)) return null;
  const link = (event.target as Element | null)?.closest<HTMLAnchorElement>("a[href]");
  if (!link || link.target === "_blank" || link.hasAttribute("download")) return null;
  return link;
}

/**
 * While there are unsaved changes, a link on the page asks first (see
 * UnsavedChangesDialog), and anything else leaving the page (reloading,
 * closing the tab, typing an address) gets the browser's own warning.
 */
export function useLeaveGuard(hasUnsavedChanges: boolean) {
  const [blockedHref, setBlockedHref] = useState<string | null>(null);
  const isLeavingOnPurpose = useRef(false);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warn = (event: BeforeUnloadEvent) => {
      if (!isLeavingOnPurpose.current) event.preventDefault();
    };
    const holdLink = (event: MouseEvent) => {
      const link = followedLink(event);
      if (!link) return;
      event.preventDefault();
      setBlockedHref(link.href);
    };
    window.addEventListener("beforeunload", warn);
    // Capturing, so it runs before the link's own handler (Next.js links skip a prevented click).
    document.addEventListener("click", holdLink, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", holdLink, true);
    };
  }, [hasUnsavedChanges]);

  function leave() {
    if (!blockedHref) return;
    isLeavingOnPurpose.current = true;
    window.location.assign(blockedHref);
  }

  return { blockedHref, stay: () => setBlockedHref(null), leave };
}

/** Asks what to do with unsaved changes before following a link: save them, drop them, or stay. */
export function UnsavedChangesDialog({
  guard,
  save,
  dict,
}: {
  guard: ReturnType<typeof useLeaveGuard>;
  save: () => Promise<boolean>;
  dict: AccountDict;
}) {
  const [isSaving, setIsSaving] = useState(false);

  async function saveAndLeave() {
    setIsSaving(true);
    const isSaved = await save();
    setIsSaving(false);
    if (isSaved) guard.leave();
    else guard.stay();
  }

  return (
    <Dialog open={guard.blockedHref !== null} onOpenChange={(open) => !open && !isSaving && guard.stay()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{dict.unsavedTitle}</DialogTitle>
          <DialogDescription>{dict.unsavedDescription}</DialogDescription>
        </DialogHeader>
        {/* Staying is the dialog's own close button, Escape or a tap outside. */}
        <DialogFooter className="gap-2 sm:flex-col-reverse sm:items-stretch">
          <Button type="button" disabled={isSaving} onClick={() => void saveAndLeave()} className="h-9 cursor-pointer gap-2">
            {isSaving && <Loader2 className="size-4 animate-spin" />}
            {dict.unsavedSave}
          </Button>
          <Button type="button" variant="outline" disabled={isSaving} onClick={guard.leave} className="h-9 cursor-pointer">
            {dict.unsavedDiscard}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
