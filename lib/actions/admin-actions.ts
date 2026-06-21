"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/admin";
import { randomToken, sha256Base64Url } from "@/lib/crypto";

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "app"
  );
}

function parseLines(value: string | undefined): string[] {
  return (value ?? "")
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

const clientSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80),
  redirectUris: z.string(),
  postLogoutRedirectUris: z.string().optional(),
  roles: z.string().optional(),
  defaultRoles: z.string().optional(),
  allowedScopes: z.string().optional(),
  trusted: z.boolean().optional(),
  confidential: z.boolean().optional(),
});

export interface ClientInput {
  name: string;
  redirectUris: string;
  postLogoutRedirectUris?: string;
  roles?: string;
  defaultRoles?: string;
  allowedScopes?: string;
  trusted?: boolean;
  confidential?: boolean;
}

export interface ClientActionResult {
  success: boolean;
  error?: string;
  secret?: string;
}

export async function createClient(
  input: ClientInput,
): Promise<ClientActionResult> {
  if (!(await getAdminUser())) return { success: false, error: "Forbidden." };

  const parsed = clientSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const redirectUris = parseLines(parsed.data.redirectUris);
  if (redirectUris.length === 0)
    return { success: false, error: "At least one redirect URI is required." };

  const roles = parseLines(parsed.data.roles);
  const defaultRoles = parseLines(parsed.data.defaultRoles);
  const allowedScopes = parseLines(parsed.data.allowedScopes);

  // A default role must be a valid role for the app (when a palette is defined).
  const palette = roles.length ? roles : ["USER", "ADMIN"];
  const unknown = defaultRoles.find((r) => !palette.includes(r));
  if (unknown)
    return { success: false, error: `"${unknown}" is not a valid role for this app.` };

  let secret: string | undefined;
  let clientSecretHash: string | undefined;
  if (parsed.data.confidential) {
    secret = randomToken(32);
    clientSecretHash = sha256Base64Url(secret);
  }

  const clientId = `${slugify(parsed.data.name)}-${randomToken(6)}`;

  await prisma.client.create({
    data: {
      clientId,
      name: parsed.data.name,
      redirectUris,
      postLogoutRedirectUris: parseLines(parsed.data.postLogoutRedirectUris),
      trusted: Boolean(parsed.data.trusted),
      clientSecretHash,
      ...(roles.length ? { roles } : {}),
      ...(defaultRoles.length ? { defaultRoles } : {}),
      ...(allowedScopes.length ? { allowedScopes } : {}),
    },
  });

  return { success: true, secret };
}

export async function updateClient(
  id: string,
  input: ClientInput,
): Promise<ClientActionResult> {
  if (!(await getAdminUser())) return { success: false, error: "Forbidden." };

  const parsed = clientSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const redirectUris = parseLines(parsed.data.redirectUris);
  if (redirectUris.length === 0)
    return { success: false, error: "At least one redirect URI is required." };

  const roles = parseLines(parsed.data.roles);
  const defaultRoles = parseLines(parsed.data.defaultRoles);
  const palette = roles.length ? roles : ["USER", "ADMIN"];
  const unknown = defaultRoles.find((r) => !palette.includes(r));
  if (unknown)
    return { success: false, error: `"${unknown}" is not a valid role for this app.` };

  await prisma.client.update({
    where: { id },
    data: {
      name: parsed.data.name,
      redirectUris,
      postLogoutRedirectUris: parseLines(parsed.data.postLogoutRedirectUris),
      trusted: Boolean(parsed.data.trusted),
      roles,
      defaultRoles,
      allowedScopes: parseLines(parsed.data.allowedScopes),
    },
  });

  return { success: true };
}

export async function regenerateClientSecret(
  id: string,
): Promise<ClientActionResult> {
  if (!(await getAdminUser())) return { success: false, error: "Forbidden." };
  const secret = randomToken(32);
  await prisma.client.update({
    where: { id },
    data: { clientSecretHash: sha256Base64Url(secret) },
  });
  return { success: true, secret };
}

export async function deleteClient(id: string): Promise<ClientActionResult> {
  if (!(await getAdminUser())) return { success: false, error: "Forbidden." };
  await prisma.client.delete({ where: { id } });
  return { success: true };
}

export interface AdminResult {
  success: boolean;
  error?: string;
}

export async function setUserRoles(
  userId: string,
  clientDbId: string,
  roles: string[],
): Promise<AdminResult> {
  if (!(await getAdminUser())) return { success: false, error: "Forbidden." };
  await prisma.appMembership.updateMany({
    where: { userId, clientId: clientDbId },
    data: { roles },
  });
  return { success: true };
}
