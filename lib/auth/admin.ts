import "server-only";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdmin } from "@/lib/oidc/tokens";
import type { User } from "@/lib/generated/prisma/client";

export async function getAdminUser(): Promise<User | null> {
  const user = await getCurrentUser();
  if (!user || !isAdmin(user.email)) return null;
  return user;
}
