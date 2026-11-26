"use client";

import { useEffect, useState } from "react";

/**
 * State that holds while the page leaves (a spinner until the next page
 * opens). The Back button can bring the page back from memory exactly as it
 * was, so it returns to `initial` then.
 */
export function useStateResetOnBack<T>(initial: T) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const resetWhenRestored = (event: PageTransitionEvent) => {
      if (event.persisted) setValue(initial);
    };
    window.addEventListener("pageshow", resetWhenRestored);
    return () => window.removeEventListener("pageshow", resetWhenRestored);
  }, [initial]);
  return [value, setValue] as const;
}
