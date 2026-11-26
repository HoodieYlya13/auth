import { ArrowLeft } from "lucide-react";
import { findSigningInApp } from "@/lib/oidc/clients";

/**
 * "Back to {app}" in the corner opposite the language switch, during a sign-in
 * for an app. Fixed, so nothing on the page moves when it streams in.
 */
export async function BackToSigningInApp({
  searchParams,
  label,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  label: string;
}) {
  const { return_to } = await searchParams;
  const app = await findSigningInApp(typeof return_to === "string" ? return_to : undefined);
  if (!app) return null;
  return (
    <a
      href={app.homeUrl}
      className="fixed top-3 left-3 z-50 inline-flex max-w-[60vw] items-center gap-1.5 rounded-full border border-border bg-card/80 px-3 py-1 text-xs font-semibold text-muted-foreground shadow-sm backdrop-blur hover:text-foreground"
    >
      <ArrowLeft className="size-3.5 shrink-0" />
      <span className="truncate">{label.replace("{app}", app.name)}</span>
    </a>
  );
}
