"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ConfirmRequest {
  question: string;
  confirmLabel: string;
  answer: (isConfirmed: boolean) => void;
}

/**
 * A styled stand-in for window.confirm: `await confirm(question, confirmLabel)`
 * resolves true once confirmed, false when cancelled or dismissed. Render
 * `dialog` once in the component.
 */
export function useConfirmDialog(cancelLabel: string) {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  const confirm = (question: string, confirmLabel: string) =>
    new Promise<boolean>((resolve) => setRequest({ question, confirmLabel, answer: resolve }));

  function answer(isConfirmed: boolean) {
    request?.answer(isConfirmed);
    setRequest(null);
  }

  const dialog = (
    <Dialog open={request !== null} onOpenChange={(open) => !open && answer(false)}>
      <DialogContent showCloseButton={false} className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="leading-snug">{request?.question}</DialogTitle>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => answer(false)} className="h-9 cursor-pointer">
            {cancelLabel}
          </Button>
          <Button type="button" variant="destructive" autoFocus onClick={() => answer(true)} className="h-9 cursor-pointer">
            {request?.confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
