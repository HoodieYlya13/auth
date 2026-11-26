"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { ActionResult } from "@/lib/actions/account-actions";
import { tryCatch } from "@/lib/utils";

/**
 * Removes an item from a list at once, then asks the server: a refusal puts it
 * back with an error toast, a success refreshes the page's data.
 */
export function useOptimisticRemoval(messages: { removed: string; failed: string }) {
  const router = useRouter();
  const [removedIds, setRemovedIds] = useState<ReadonlySet<string>>(new Set());

  async function remove(id: string, action: () => Promise<ActionResult>) {
    setRemovedIds((ids) => new Set(ids).add(id));
    toast.success(messages.removed);
    const [error, result] = await tryCatch(action());
    if (!error && result?.success) {
      router.refresh();
      return;
    }
    setRemovedIds((ids) => {
      const kept = new Set(ids);
      kept.delete(id);
      return kept;
    });
    toast.error(result?.error || messages.failed);
  }

  const isShown = (id: string) => !removedIds.has(id);
  return { remove, isShown };
}
