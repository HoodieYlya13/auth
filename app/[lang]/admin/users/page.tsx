import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/oidc/tokens";
import { getAdminUser } from "@/lib/auth/admin";
import { UsersManager } from "@/components/admin/users-manager";

export default async function Page({
  params,
}: PageProps<"/[lang]/admin/users">) {
  await connection();
  const { lang } = await params;
  if (!hasLocale(lang)) redirect("/en");
  if (!(await getAdminUser())) redirect(`/${lang}/account`);

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      memberships: {
        include: { client: { select: { id: true, name: true, roles: true } } },
        orderBy: { linkedAt: "desc" },
      },
    },
  });
  const dict = await getDictionary(lang);

  return (
    <UsersManager
      users={users.map((u) => ({
        id: u.id,
        email: u.email,
        username: u.username,
        admin: isAdmin(u.email),
        memberships: u.memberships.map((m) => ({
          clientDbId: m.client.id,
          clientName: m.client.name,
          availableRoles: m.client.roles,
          roles: m.roles,
        })),
      }))}
      dict={dict.admin}
    />
  );
}
