import { connection } from "next/server";
import { Users, AppWindow, Monitor, Link2 } from "lucide-react";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/admin";

export default async function AdminOverview({
  params,
}: PageProps<"/[lang]/admin">) {
  await connection();
  const { lang } = await params;
  if (!hasLocale(lang)) redirect("/en");
  if (!(await getAdminUser())) redirect(`/${lang}/account`);
  const dict = await getDictionary(lang);
  const t = dict.admin;

  const [users, clients, sessions, links] = await Promise.all([
    prisma.user.count(),
    prisma.client.count(),
    prisma.session.count(),
    prisma.appMembership.count(),
  ]);

  const stats = [
    { label: t.statUsers, value: users, icon: Users },
    { label: t.statClients, value: clients, icon: AppWindow },
    { label: t.statSessions, value: sessions, icon: Monitor },
    { label: t.statLinks, value: links, icon: Link2 },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="bg-card border border-border rounded-2xl p-5 shadow-sm"
        >
          <s.icon className="size-5 text-muted-foreground mb-3" />
          <p className="text-2xl font-semibold tabular-nums">{s.value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
        </div>
      ))}
    </div>
  );
}
