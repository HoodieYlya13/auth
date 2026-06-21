import "server-only";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/oidc/tokens";
import type { User } from "@/lib/generated/prisma/client";

export async function resolveRoles(
  user: User,
  clientDbId: string,
): Promise<string[]> {
  const membership = await prisma.appMembership.findUnique({
    where: { userId_clientId: { userId: user.id, clientId: clientDbId } },
    select: { roles: true },
  });
  const roles = membership?.roles ?? [];
  if (isAdmin(user.email) && !roles.includes("ADMIN"))
    return [...roles, "ADMIN"];
  return roles;
}
