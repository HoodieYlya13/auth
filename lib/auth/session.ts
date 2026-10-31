import "server-only";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import type { User } from "@/lib/generated/prisma/client";

const COOKIE = "auth_session";
const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires,
  };
}

export async function createSession(
  userId: string,
  userAgent?: string,
): Promise<void> {
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);
  const session = await prisma.session.create({
    data: { userId, expiresAt, userAgent },
  });
  const store = await cookies();
  store.set(COOKIE, session.id, cookieOptions(expiresAt));
}

export async function getSession(): Promise<{
  user: User;
  sessionId: string;
} | null> {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (!id) return null;

  const session = await prisma.session.findUnique({
    where: { id },
    include: { user: true },
  });
  if (!session) return null;

  if (session.expiresAt < new Date()) {
    await prisma.session.delete({ where: { id } }).catch(() => {});
    return null;
  }
  return { user: session.user, sessionId: session.id };
}

export async function getCurrentUser(): Promise<User | null> {
  return (await getSession())?.user ?? null;
}

/**
 * Signs out of one sign-in, and out of every app it signed into: their refresh
 * tokens are revoked, so each app is signed out at its next refresh. A session
 * that merely expires is deleted without this, and apps keep their sign-in.
 */
async function endSession(id: string, userId?: string): Promise<void> {
  await prisma.$transaction([
    prisma.refreshToken.updateMany({
      where: { sessionId: id, ...(userId ? { userId } : {}) },
      data: { revoked: true },
    }),
    prisma.session.deleteMany({ where: { id, ...(userId ? { userId } : {}) } }),
  ]);
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const id = store.get(COOKIE)?.value;
  if (id) {
    await endSession(id).catch(() => {});
    store.delete(COOKIE);
  }
}

export async function revokeSession(
  sessionId: string,
  userId: string,
): Promise<void> {
  await endSession(sessionId, userId);
}
