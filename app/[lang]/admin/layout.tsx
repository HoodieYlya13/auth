import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { getAdminUser } from "@/lib/auth/admin";
import Link from "next/link";
import { Suspense } from "react";

async function AdminGuard({
  children,
  lang,
}: {
  children: React.ReactNode;
  lang: string;
}) {
  const admin = await getAdminUser();
  if (!admin) redirect(`/${lang}/account`);
  return <>{children}</>;
}

export default async function AdminLayout({
  children,
  params,
}: LayoutProps<"/[lang]/admin">) {
  const { lang } = await params;
  if (!hasLocale(lang)) redirect("/en");

  const dict = await getDictionary(lang);
  const t = dict.admin;
  const nav = [
    { href: `/${lang}/admin`, label: t.overview },
    { href: `/${lang}/admin/clients`, label: t.clients },
    { href: `/${lang}/admin/users`, label: t.users },
  ];

  return (
    <div className="min-h-screen min-h-svh bg-background">
      <header className="border-b border-border">
        <div className="mx-auto max-w-4xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <span className="font-semibold">{t.title}</span>
            <nav className="flex items-center gap-4 text-sm">
              {nav.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
          <Link
            href={`/${lang}/account`}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            {t.backToAccount}
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-4 py-8">
        <Suspense
          fallback={
            <div className="animate-pulse space-y-4">
              <div className="h-32 bg-muted rounded-2xl w-full" />
            </div>
          }
        >
          <AdminGuard lang={lang}>{children}</AdminGuard>
        </Suspense>
      </main>
    </div>
  );
}
