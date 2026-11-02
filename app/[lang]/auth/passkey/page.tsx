import { redirect } from "next/navigation";
import { Fingerprint } from "lucide-react";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPasskey } from "@/lib/auth/passkey-prompt";
import { PasskeyPrompt } from "@/components/auth/passkey-prompt";
import { safeReturnTo } from "@/lib/redirect";
import { findReturnApp } from "@/lib/oidc/clients";
import { Suspense } from "react";

function PromptSkeleton() {
  return (
    <div className="flex flex-col gap-3 animate-pulse">
      <div className="h-9 bg-muted rounded-lg w-full" />
      <div className="h-9 bg-muted rounded-lg w-full" />
    </div>
  );
}

async function PromptSection({
  lang,
  searchParams,
  dict,
}: {
  lang: string;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
  dict: Awaited<ReturnType<typeof getDictionary>>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect(`/${lang}`);

  const { return_to, client_id, return_path } = await searchParams;
  const returnTo = safeReturnTo(
    typeof return_to === "string" ? return_to : undefined,
  );
  // Sent by an app (?client_id=, optional ?return_path=): back to it after,
  // with the origin from its registered homeUrl, as on the account page.
  const app = await findReturnApp(
    typeof client_id === "string" ? client_id : undefined,
    user.id,
  );
  const appPath = safeReturnTo(
    typeof return_path === "string" ? return_path : undefined,
  );
  const appHref =
    app && (appPath ? new URL(appPath, app.homeUrl).href : app.homeUrl);
  const next = appHref ?? returnTo ?? `/${lang}/account`;

  if (!user.username) redirect(`/${lang}/auth/complete-registration`);
  // Added one meanwhile (another tab, the Back button): nothing to offer.
  if (await hasPasskey(user.id)) redirect(next);

  return <PasskeyPrompt next={next} dict={dict.passkeyPrompt} />;
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { lang } = await params;
  if (!hasLocale(lang)) redirect("/en");

  const dict = await getDictionary(lang);

  return (
    <main className="flex min-h-screen min-h-svh flex-col items-center justify-center bg-background px-4 py-12 selection:bg-primary/20 selection:text-primary">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(99,102,241,0.08),transparent)] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl p-8 shadow-md">
        <div className="flex flex-col space-y-2 text-center mb-8">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Fingerprint className="size-5" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dict.passkeyPrompt.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dict.passkeyPrompt.description}
          </p>
        </div>

        <Suspense fallback={<PromptSkeleton />}>
          <PromptSection lang={lang} searchParams={searchParams} dict={dict} />
        </Suspense>
      </div>
    </main>
  );
}
