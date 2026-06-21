import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { getCurrentUser } from "@/lib/auth/session";
import { getClient } from "@/lib/oidc/clients";
import { parseAuthorizeReturnTo } from "@/lib/oidc/authorize-params";
import { prisma } from "@/lib/db";
import { ConsentForm } from "@/components/auth/consent-form";
import { Suspense } from "react";

function ConsentSkeleton() {
  return (
    <div className="relative z-10 w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl p-8 shadow-md animate-pulse">
      <div className="flex flex-col space-y-2 text-center mb-8">
        <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-muted" />
        <div className="h-6 bg-muted rounded w-3/4 mx-auto" />
        <div className="h-4 bg-muted rounded w-5/6 mx-auto mt-2" />
      </div>
      <div className="space-y-4">
        <div className="h-4 bg-muted rounded w-1/4" />
        <div className="space-y-2">
          <div className="h-5 bg-muted rounded-md w-full" />
          <div className="h-5 bg-muted rounded-md w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 mt-6">
          <div className="h-9 bg-muted rounded-lg w-full" />
          <div className="h-9 bg-muted rounded-lg w-full" />
        </div>
      </div>
    </div>
  );
}

async function ConsentSection({
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

  const { return_to } = await searchParams;
  const returnTo = typeof return_to === "string" ? return_to : undefined;
  const parsed = returnTo ? parseAuthorizeReturnTo(returnTo) : null;
  if (!returnTo || !parsed) redirect(`/${lang}/account`);

  const client = await getClient(parsed.clientId);
  if (!client) redirect(`/${lang}/account`);

  const membership = await prisma.appMembership.findUnique({
    where: { userId_clientId: { userId: user.id, clientId: client.id } },
  });
  if (membership) redirect(returnTo);

  const scopes = parsed.scope.split(/\s+/).filter(Boolean);

  return (
    <div className="relative z-10 w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl p-8 shadow-md">
      <div className="flex flex-col space-y-2 text-center mb-8">
        <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <ShieldCheck className="size-5" strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {dict.consent.title.replace("{app}", client.name)}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dict.consent.description.replace("{app}", client.name)}
        </p>
      </div>

      <ConsentForm
        returnTo={returnTo}
        email={user.email}
        scopes={scopes}
        dict={dict.consent}
      />
    </div>
  );
}

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[lang]/consent">) {
  const { lang } = await params;
  if (!hasLocale(lang)) redirect("/en");

  const dict = await getDictionary(lang);

  return (
    <main className="flex min-h-screen min-h-svh flex-col items-center justify-center bg-background px-4 py-12 selection:bg-primary/20 selection:text-primary">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(99,102,241,0.08),transparent)] pointer-events-none"></div>

      <Suspense fallback={<ConsentSkeleton />}>
        <ConsentSection
          lang={lang}
          searchParams={searchParams}
          dict={dict}
        />
      </Suspense>
    </main>
  );
}
