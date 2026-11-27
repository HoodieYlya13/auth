import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ShieldAlert } from "lucide-react";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { findClaimBack } from "@/lib/auth/email-claim-back";
import { ClaimBackFlow } from "@/components/account/claim-back-flow";

type ClaimBackDict = Awaited<ReturnType<typeof getDictionary>>["claimBack"];

async function ClaimBackSection({ lang, dict, searchParams }: { lang: string; dict: ClaimBackDict; searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  const claimBack = token ? await findClaimBack(token) : null;
  if (!token || !claimBack) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-muted-foreground">{dict.linkGone}</p>
        <a href={`/${lang}`} className="text-sm underline underline-offset-4">{dict.home}</a>
      </div>
    );
  }
  return <ClaimBackFlow token={token} formerEmail={claimBack.formerEmail} locale={lang} dict={dict} />;
}

export default async function Page({ params, searchParams }: { params: Promise<{ lang: string }>; searchParams: Promise<{ token?: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) redirect("/en");
  const dict = (await getDictionary(lang)).claimBack;

  return (
    <main className="flex min-h-screen min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl p-8 shadow-md">
        <div className="flex flex-col space-y-2 text-center mb-8">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-destructive/15 text-destructive shadow-sm">
            <ShieldAlert className="size-5" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{dict.title}</h1>
        </div>
        <Suspense fallback={<div className="h-24 animate-pulse rounded-lg bg-muted" />}>
          <ClaimBackSection lang={lang} dict={dict} searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
