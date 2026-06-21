import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getDictionary, hasLocale } from "@/lib/dictionaries/dictionaries";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/admin";
import { ClientsManager } from "@/components/admin/clients-manager";

export default async function Page({
  params,
}: PageProps<"/[lang]/admin/clients">) {
  await connection();
  const { lang } = await params;
  if (!hasLocale(lang)) redirect("/en");
  if (!(await getAdminUser())) redirect(`/${lang}/account`);

  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "desc" },
  });
  const dict = await getDictionary(lang);

  return (
    <ClientsManager
      clients={clients.map((c) => ({
        id: c.id,
        clientId: c.clientId,
        name: c.name,
        redirectUris: c.redirectUris,
        postLogoutRedirectUris: c.postLogoutRedirectUris,
        trusted: c.trusted,
        roles: c.roles,
        defaultRoles: c.defaultRoles,
        allowedScopes: c.allowedScopes,
        confidential: Boolean(c.clientSecretHash),
      }))}
      dict={dict.admin}
    />
  );
}
