import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, AtSign } from "lucide-react";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { getSession } from "@/lib/auth/session";
import { hasPasskey } from "@/lib/auth/passkey-prompt";
import { EmailChangeFlow } from "@/components/account/email-change-flow";

type Dict = Awaited<ReturnType<typeof getDictionary>>;

function FlowSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/2" />
      <div className="h-9 bg-muted rounded-lg w-full" />
      <div className="h-9 bg-muted rounded-lg w-full" />
    </div>
  );
}

async function FlowSection({ lang, dict }: { lang: string; dict: Dict }) {
  const session = await getSession();
  if (!session) redirect(`/${lang}`);
  const { user } = session;
  return (
    <>
      <p className="-mt-4 mb-6 text-center text-xs text-muted-foreground break-all">
        {dict.emailChange.current.replace("{email}", user.email)}
      </p>
      <EmailChangeFlow currentEmail={user.email} hasPasskey={await hasPasskey(user.id)} locale={lang} dict={dict.emailChange} identityDict={dict.confirmIdentity} />
    </>
  );
}

export default async function Page({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  if (!hasLocale(lang)) redirect("/en");
  const dict = await getDictionary(lang);
  const t = dict.emailChange;

  return (
    <main className="flex min-h-screen min-h-svh flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md flex flex-col gap-4">
        <a href={`/${lang}/account`} className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          {t.backToAccount}
        </a>
        <div className="w-full bg-card text-card-foreground border border-border rounded-2xl p-8 shadow-md">
          <div className="flex flex-col space-y-2 text-center mb-8">
            <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <AtSign className="size-5" strokeWidth={2.5} />
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
            <p className="text-sm text-muted-foreground">{t.description}</p>
          </div>
          <Suspense fallback={<FlowSkeleton />}>
            <FlowSection lang={lang} dict={dict} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
