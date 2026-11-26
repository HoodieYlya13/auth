"use client";

import { usePathname } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

const MESSAGES = {
  en: { title: "Something went wrong", retry: "Try again" },
  fr: { title: "Une erreur est survenue", retry: "Réessayer" },
} as const;

/** Stays put: an error thrown while a sign-in is already on its way back to the app must not send it elsewhere. */
export default function ErrorPage({ reset }: { reset: () => void }) {
  const locale = usePathname().split("/")[1] === "fr" ? "fr" : "en";
  const t = MESSAGES[locale];
  return (
    <main className="flex min-h-screen min-h-svh flex-col items-center justify-center gap-4 bg-background px-4 text-center">
      <p className="text-sm text-muted-foreground">{t.title}</p>
      <Button type="button" variant="outline" onClick={reset} className="h-9 cursor-pointer gap-2">
        <RotateCcw className="size-4" />
        {t.retry}
      </Button>
    </main>
  );
}
