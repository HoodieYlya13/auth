"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const LOCALES = [
  { code: "en", label: "EN", name: "English" },
  { code: "fr", label: "FR", name: "Français" },
] as const;

/** This page in `locale`, with its query string: an app's return_to and client_id ride along. */
function sameAddressIn(locale: string, pathname: string, search: string): string {
  const [, , ...rest] = pathname.split("/");
  const path = `/${[locale, ...rest].join("/")}`;
  return search ? `${path}?${search}` : path;
}

/**
 * EN · FR in a corner of every page. A plain link, so the page loads again in
 * the other language: the sign-in form comes back to its step (see
 * sign-in-draft), and unsaved account changes ask first (see useLeaveGuard).
 */
export function LocaleSwitcher({ current, label }: { current: string; label: string }) {
  const pathname = usePathname();
  const search = useSearchParams().toString();

  return (
    <nav aria-label={label} className="fixed top-3 right-3 z-50 flex rounded-full border border-border bg-card/80 p-0.5 text-xs font-semibold shadow-sm backdrop-blur">
      {LOCALES.map(({ code, label: short, name }) => {
        const isCurrent = code === current;
        return (
          <a
            key={code}
            href={sameAddressIn(code, pathname, search)}
            hrefLang={code}
            lang={code}
            aria-label={name}
            aria-current={isCurrent ? "true" : undefined}
            className={cn(
              "rounded-full px-2.5 py-1 transition-colors",
              isCurrent ? "pointer-events-none bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {short}
          </a>
        );
      })}
    </nav>
  );
}
