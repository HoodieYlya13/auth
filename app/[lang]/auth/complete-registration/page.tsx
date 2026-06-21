import { redirect } from "next/navigation";
import { UserPlus } from "lucide-react";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { getCurrentUser } from "@/lib/auth/session";
import { CompleteRegistrationForm } from "@/components/auth/complete-registration-form";
import { Suspense } from "react";

function safeReturnTo(value: string | undefined): string | undefined {
  if (value && value.startsWith("/") && !value.startsWith("//")) return value;
  return undefined;
}

function RegistrationFormSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-4 bg-muted rounded w-1/3" />
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-1/4" />
        <div className="h-9 bg-muted rounded-lg w-full" />
        <div className="h-3 bg-muted rounded w-2/3" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-9 bg-muted rounded-lg w-full" />
        </div>
        <div className="space-y-2">
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-9 bg-muted rounded-lg w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-9 bg-muted rounded-lg w-full" />
      </div>
      <div className="h-9 bg-muted rounded-lg w-full mt-2" />
    </div>
  );
}

async function RegistrationFormSection({
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
  const returnTo = safeReturnTo(
    typeof return_to === "string" ? return_to : undefined,
  );

  if (user.username) redirect(returnTo ?? `/${lang}/account`);

  return (
    <CompleteRegistrationForm
      locale={lang}
      returnTo={returnTo}
      email={user.email}
      dict={dict.register}
    />
  );
}

export default async function Page({
  params,
  searchParams,
}: PageProps<"/[lang]/auth/complete-registration">) {
  const { lang } = await params;
  if (!hasLocale(lang)) redirect("/en");

  const dict = await getDictionary(lang);

  return (
    <main className="flex min-h-screen min-h-svh flex-col items-center justify-center bg-background px-4 py-12 selection:bg-primary/20 selection:text-primary">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(99,102,241,0.08),transparent)] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl p-8 shadow-md">
        <div className="flex flex-col space-y-2 text-center mb-8">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <UserPlus className="size-5" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dict.register.title}
          </h1>
          <p className="text-sm text-muted-foreground">
            {dict.register.description}
          </p>
        </div>

        <Suspense fallback={<RegistrationFormSkeleton />}>
          <RegistrationFormSection
            lang={lang}
            searchParams={searchParams}
            dict={dict}
          />
        </Suspense>
      </div>
    </main>
  );
}
