"use server";

import { z } from "zod";
import { prisma } from "@/lib/db";
import { getAdminUser } from "@/lib/auth/admin";
import { randomToken, sha256Base64Url } from "@/lib/crypto";
import { homeUrlProblem, redirectUriProblem } from "@/lib/oidc/clients";
import { SUPPORTED_SCOPES } from "@/lib/oidc/discovery";

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
  homeUrl: z.string().trim().optional(),
  roles: z.string().optional(),
  defaultRoles: z.string().optional(),
  allowedScopes: z.string().optional(),
  trusted: z.boolean().optional(),
  confidential: z.boolean().optional(),
});

/** The checks both forms share: redirect URIs, scopes and default roles. */
function checkClient(data: z.infer<typeof clientSchema>) {
  const redirectUris = parseLines(data.redirectUris);
  if (redirectUris.length === 0)
    return { error: "At least one redirect URI is required." } as const;
  const postLogoutRedirectUris = parseLines(data.postLogoutRedirectUris);
  for (const uri of [...redirectUris, ...postLogoutRedirectUris]) {
    const problem = redirectUriProblem(uri);
    if (problem) return { error: problem } as const;
  }
  const homeUrl = data.homeUrl || null;
  if (homeUrl) {
    const problem = homeUrlProblem(homeUrl, redirectUris);
    if (problem) return { error: problem } as const;
  }

  const allowedScopes = parseLines(data.allowedScopes);
  const unknownScope = allowedScopes.find((s) => !SUPPORTED_SCOPES.includes(s));
  if (unknownScope)
    return { error: `"${unknownScope}" is not a supported scope.` } as const;

  const roles = parseLines(data.roles);
  const defaultRoles = parseLines(data.defaultRoles);
  // A default role must be a valid role for the app (when a palette is defined).
  const palette = roles.length ? roles : ["USER", "ADMIN"];
  const unknown = defaultRoles.find((r) => !palette.includes(r));
  if (unknown)
    return { error: `"${unknown}" is not a valid role for this app.` } as const;

  return { redirectUris, postLogoutRedirectUris, homeUrl, allowedScopes, roles, defaultRoles } as const;
}

export interface ClientInput {
  name: string;
  redirectUris: string;
  postLogoutRedirectUris?: string;
  homeUrl?: string;
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
  const checked = checkClient(parsed.data);
  if ("error" in checked) return { success: false, error: checked.error };
  const { redirectUris, postLogoutRedirectUris, homeUrl, allowedScopes, roles, defaultRoles } = checked;

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
      postLogoutRedirectUris,
      homeUrl,
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
  const checked = checkClient(parsed.data);
  if ("error" in checked) return { success: false, error: checked.error };

  await prisma.client.update({
    where: { id },
    data: {
      name: parsed.data.name,
      redirectUris: checked.redirectUris,
      postLogoutRedirectUris: checked.postLogoutRedirectUris,
      homeUrl: checked.homeUrl,
      trusted: Boolean(parsed.data.trusted),
      roles: checked.roles,
      defaultRoles: checked.defaultRoles,
      allowedScopes: checked.allowedScopes,
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
  const client = await prisma.client.findUnique({
    where: { id: clientDbId },
    select: { roles: true },
  });
  if (!client) return { success: false, error: "Unknown application." };
  const palette = client.roles.length ? client.roles : ["USER", "ADMIN"];
  const unknown = roles.find((r) => !palette.includes(r));
  if (unknown)
    return { success: false, error: `"${unknown}" is not a valid role for this app.` };
  await prisma.appMembership.updateMany({
    where: { userId, clientId: clientDbId },
    data: { roles },
  });
  return { success: true };
}
