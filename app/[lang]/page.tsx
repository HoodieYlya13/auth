import { redirect } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { AuthForm } from "@/components/auth/auth-form";
import { Lock } from "lucide-react";
import { Suspense } from "react";

function AuthFormSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="space-y-2">
        <div className="h-9 bg-muted rounded-lg w-full" />
        <div className="h-3 bg-muted rounded w-3/4" />
      </div>
      <div className="h-4 bg-muted rounded w-1/4 mx-auto" />
      <div className="space-y-2">
        <div className="h-9 bg-muted rounded-lg w-full" />
        <div className="h-9 bg-muted rounded-lg w-full" />
        <div className="h-3 bg-muted rounded w-3/4" />
      </div>
    </div>
  );
}

export default async function Page({
  params,
}: PageProps<"/[lang]">) {
  const { lang } = await params;

  if (!hasLocale(lang)) redirect("/en");

  const dict = await getDictionary(lang);

  return (
    <main className="flex min-h-screen min-h-svh flex-col items-center justify-center bg-background px-4 py-12 selection:bg-primary/20 selection:text-primary">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,rgba(99,102,241,0.08),transparent)] pointer-events-none"></div>

      <div className="relative z-10 w-full max-w-md bg-card text-card-foreground border border-border rounded-2xl p-8 shadow-md">
        <div className="flex flex-col space-y-2 text-center mb-8">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Lock className="size-5" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {dict.welcome}
          </h1>
          <p className="text-sm text-muted-foreground">{dict.description}</p>
        </div>

        <Suspense fallback={<AuthFormSkeleton />}>
          <AuthForm locale={lang} dict={dict} />
        </Suspense>
      </div>
    </main>
  );
}
