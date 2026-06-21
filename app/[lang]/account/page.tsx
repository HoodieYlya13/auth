import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { getSession } from "@/lib/auth/session";
import { isAdmin } from "@/lib/oidc/tokens";
import { prisma } from "@/lib/db";
import { ProfileSection } from "@/components/account/profile-section";
import { PasskeysSection } from "@/components/account/passkeys-section";
import { AppsSection } from "@/components/account/apps-section";
import { SessionsSection } from "@/components/account/sessions-section";
import { SignOutButton } from "@/components/account/sign-out-button";
import Link from "next/link";
import { Suspense } from "react";
import type { AccountDict } from "@/components/account/account-dict";

function SectionSkeleton({ title }: { title: string }) {
  return (
    <section className="bg-card text-card-foreground border border-border rounded-2xl p-6 shadow-sm animate-pulse">
      <div className="flex items-start justify-between gap-4 mb-4">
        <h2 className="text-base font-semibold">{title}</h2>
      </div>
      <div className="space-y-3">
        <div className="h-10 bg-muted rounded-lg w-full" />
        <div className="h-10 bg-muted rounded-lg w-5/6" />
      </div>
    </section>
  );
}

async function UserEmailSection() {
  const session = await getSession();
  if (!session) return null;
  return <p className="text-sm text-muted-foreground">{session.user.email}</p>;
}

async function AdminDashboardButton({ lang, dict }: { lang: string; dict: AccountDict }) {
  const session = await getSession();
  if (!session) return null;
  const admin = isAdmin(session.user.email);
  if (!admin) return null;
  return (
    <Link
      href={`/${lang}/admin`}
      className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md border border-border text-sm font-medium hover:bg-accent"
    >
      <ShieldCheck className="size-4" />
      {dict.adminDashboard}
    </Link>
  );
}

async function ProfileSectionWrapper({ lang, dict }: { lang: string; dict: AccountDict }) {
  const session = await getSession();
  if (!session) redirect(`/${lang}`);
  const { user } = session;
  if (!user.username) redirect(`/${lang}/auth/complete-registration`);

  return (
    <ProfileSection
      initial={{
        username: user.username,
        firstName: user.firstName ?? "",
        lastName: user.lastName ?? "",
        birthday: user.birthday
          ? user.birthday.toISOString().slice(0, 10)
          : "",
      }}
      dict={dict}
    />
  );
}

async function PasskeysSectionWrapper({ lang, dict }: { lang: string; dict: AccountDict }) {
  const session = await getSession();
  if (!session) redirect(`/${lang}`);
  const { user } = session;

  const credentials = await prisma.credential.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <PasskeysSection
      passkeys={credentials.map((c) => ({
        id: c.id,
        name: c.name,
        deviceType: c.deviceType,
        backedUp: c.backedUp,
        createdAt: c.createdAt.toISOString(),
        lastUsedAt: c.lastUsedAt?.toISOString() ?? null,
      }))}
      dict={dict}
    />
  );
}

async function AppsSectionWrapper({ lang, dict }: { lang: string; dict: AccountDict }) {
  const session = await getSession();
  if (!session) redirect(`/${lang}`);
  const { user } = session;

  const memberships = await prisma.appMembership.findMany({
    where: { userId: user.id },
    include: { client: { select: { id: true, name: true, logoUrl: true } } },
    orderBy: { linkedAt: "desc" },
  });

  return (
    <AppsSection
      apps={memberships.map((m) => ({
        clientDbId: m.client.id,
        name: m.client.name,
        roles: m.roles,
        linkedAt: m.linkedAt.toISOString(),
      }))}
      dict={dict}
    />
  );
}

async function SessionsSectionWrapper({ lang, dict }: { lang: string; dict: AccountDict }) {
  const session = await getSession();
  if (!session) redirect(`/${lang}`);
  const { user } = session;

  const sessions = await prisma.session.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  return (
    <SessionsSection
      sessions={sessions.map((s) => ({
        id: s.id,
        isCurrent: s.id === session.sessionId,
        userAgent: s.userAgent,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      }))}
      dict={dict}
    />
  );
}

export default async function Page({ params }: PageProps<"/[lang]/account">) {
  const { lang } = await params;
  if (!hasLocale(lang)) redirect("/en");

  const dict = await getDictionary(lang);
  const t = dict.account;

  return (
    <main className="min-h-screen min-h-svh bg-background px-4 py-12">
      <div className="mx-auto w-full max-w-2xl flex flex-col gap-6">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
            <Suspense fallback={<div className="h-4 w-48 bg-muted rounded animate-pulse mt-1" />}>
              <UserEmailSection />
            </Suspense>
          </div>
          <div className="flex items-center gap-2">
            <Suspense fallback={<div className="h-9 w-32 bg-muted rounded animate-pulse" />}>
              <AdminDashboardButton lang={lang} dict={t} />
            </Suspense>
            <SignOutButton locale={lang} label={t.signOut} />
          </div>
        </header>

        <Suspense fallback={<SectionSkeleton title={t.profileTitle} />}>
          <ProfileSectionWrapper lang={lang} dict={t} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title={t.passkeysTitle} />}>
          <PasskeysSectionWrapper lang={lang} dict={t} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title={t.appsTitle} />}>
          <AppsSectionWrapper lang={lang} dict={t} />
        </Suspense>

        <Suspense fallback={<SectionSkeleton title={t.sessionsTitle} />}>
          <SessionsSectionWrapper lang={lang} dict={t} />
        </Suspense>
      </div>
    </main>
  );
}
