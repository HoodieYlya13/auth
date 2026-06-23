"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db";
import { tryCatch } from "@/lib/utils";
import {
  destroySession,
  getCurrentUser,
  getSession,
  revokeSession,
} from "@/lib/auth/session";
import {
  finishPasskeyRegistration,
  startPasskeyRegistration,
} from "@/lib/auth/webauthn";

const DEFAULT_LOCALE = "en";

function safeReturnTo(returnTo: string | undefined): string | undefined {
  if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return undefined;
}

const profileSchema = z.object({
  username: z
    .string()
    .trim()
    .min(3, "Username must be at least 3 characters.")
    .max(30, "Username must be at most 30 characters.")
    .regex(/^[a-zA-Z0-9_]+$/, "Use only letters, numbers, and underscores."),
  firstName: z.string().trim().max(50).optional(),
  lastName: z.string().trim().max(50).optional(),
  birthday: z.string().trim().optional(),
});

export interface RegistrationInput {
  username: string;
  firstName?: string;
  lastName?: string;
  birthday?: string;
}

export interface RegistrationResult {
  success: boolean;
  error?: string;
  redirectTo?: string;
}

function parseBirthday(value: string | undefined): Date | null | "invalid" {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date > new Date()) return "invalid";
  return date;
}

export async function completeRegistration(
  input: RegistrationInput,
  locale: string = DEFAULT_LOCALE,
  returnTo?: string,
): Promise<RegistrationResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "You are not signed in." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const birthday = parseBirthday(parsed.data.birthday);
  if (birthday === "invalid")
    return { success: false, error: "Please enter a valid birthday." };

  const username = parsed.data.username;
  const taken = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
      NOT: { id: user.id },
    },
    select: { id: true },
  });
  if (taken)
    return { success: false, error: "That username is already taken." };

  const [error] = await tryCatch(
    prisma.user.update({
      where: { id: user.id },
      data: {
        username,
        firstName: parsed.data.firstName || null,
        lastName: parsed.data.lastName || null,
        birthday,
      },
    }),
  );
  if (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { success: false, error: "That username is already taken." };
    throw error;
  }

  return {
    success: true,
    redirectTo: safeReturnTo(returnTo) ?? `/${locale}/account`,
  };
}

export interface ActionResult {
  success: boolean;
  error?: string;
}

export async function updateProfile(
  input: RegistrationInput,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "You are not signed in." };

  const parsed = profileSchema.safeParse(input);
  if (!parsed.success)
    return { success: false, error: parsed.error.issues[0]?.message };

  const birthday = parseBirthday(parsed.data.birthday);
  if (birthday === "invalid")
    return { success: false, error: "Please enter a valid birthday." };

  const username = parsed.data.username;
  const taken = await prisma.user.findFirst({
    where: {
      username: {
        equals: username,
        mode: "insensitive",
      },
      NOT: { id: user.id },
    },
    select: { id: true },
  });
  if (taken)
    return { success: false, error: "That username is already taken." };

  const [error] = await tryCatch(
    prisma.user.update({
      where: { id: user.id },
      data: {
        username,
        firstName: parsed.data.firstName || null,
        lastName: parsed.data.lastName || null,
        birthday,
      },
    }),
  );
  if (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      return { success: false, error: "That username is already taken." };
    throw error;
  }

  return { success: true };
}

export interface PasskeyRegisterBegin {
  success: boolean;
  options?: Awaited<ReturnType<typeof startPasskeyRegistration>>;
  error?: string;
}

export async function beginPasskeyRegistrationAction(): Promise<PasskeyRegisterBegin> {
  const [authError, user] = await tryCatch(getCurrentUser());
  if (authError)
    return { success: false, error: "Could not start passkey registration." };
  if (!user) return { success: false, error: "You are not signed in." };

  const [error, options] = await tryCatch(
    startPasskeyRegistration({
      id: user.id,
      email: user.email,
      username: user.username,
    }),
  );
  if (error || !options)
    return { success: false, error: "Could not start passkey registration." };
  return { success: true, options };
}

export async function finishPasskeyRegistrationAction(
  response: RegistrationResponseJSON,
  label?: string,
): Promise<ActionResult> {
  const [authError, user] = await tryCatch(getCurrentUser());
  if (authError) return { success: false, error: "Could not add that passkey." };
  if (!user) return { success: false, error: "You are not signed in." };

  const [error] = await tryCatch(
    finishPasskeyRegistration(user.id, response, label),
  );
  if (error) {
    console.error("Passkey registration failed:", error);
    return { success: false, error: "Could not add that passkey." };
  }
  return { success: true };
}

export async function renamePasskey(
  id: string,
  name: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "You are not signed in." };
  await prisma.credential.updateMany({
    where: { id, userId: user.id },
    data: { name: name.trim() || null },
  });
  return { success: true };
}

export async function deletePasskey(id: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "You are not signed in." };
  await prisma.credential.deleteMany({ where: { id, userId: user.id } });
  return { success: true };
}

export async function revokeApp(clientDbId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { success: false, error: "You are not signed in." };
  await prisma.appMembership.deleteMany({
    where: { clientId: clientDbId, userId: user.id },
  });
  await prisma.refreshToken.updateMany({
    where: { clientId: clientDbId, userId: user.id },
    data: { revoked: true },
  });
  return { success: true };
}

export async function revokeUserSession(
  sessionId: string,
): Promise<ActionResult> {
  const current = await getSession();
  if (!current) return { success: false, error: "You are not signed in." };
  if (sessionId === current.sessionId)
    return { success: false, error: "You cannot revoke your current session." };
  await revokeSession(sessionId, current.user.id);
  return { success: true };
}

export async function signOut(locale: string = DEFAULT_LOCALE): Promise<void> {
  await destroySession();
  redirect(`/${locale}`);
}
