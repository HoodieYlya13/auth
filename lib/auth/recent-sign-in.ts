import "server-only";
import { prisma } from "@/lib/db";

const RECENT_SIGN_IN_MS = 2 * 60 * 1000;

export async function signedInAt(sessionId: string): Promise<Date | null> {
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { createdAt: true },
  });
  return session?.createdAt ?? null;
}

export function isRecentSignIn(signInTime: Date | null): boolean {
  return signInTime !== null && Date.now() - signInTime.getTime() < RECENT_SIGN_IN_MS;
}
