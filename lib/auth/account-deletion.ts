import "server-only";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Signing in again within this cancels a deletion. */
export const DELETION_GRACE_DAYS = 30;
/** How long apps can still learn that an account was deleted. */
const TOMBSTONE_DAYS = 90;

/** userId → when it is deleted (ms). */
const PENDING_KEY = "account-deletions";
/** Per app (its database id): sub → when it was deleted (ms), for the app to delete its own data. */
const tombstonesKey = (clientDbId: string) => `deleted-accounts:${clientDbId}`;

/** Asks for the account to go in DELETION_GRACE_DAYS; the date it will. */
export async function scheduleDeletion(userId: string): Promise<Date> {
  const deletesAt = Date.now() + DELETION_GRACE_DAYS * DAY_MS;
  await getRedis().zadd(PENDING_KEY, { score: deletesAt, member: userId });
  return new Date(deletesAt);
}

/** Signed in again: the deletion is off. True when one was pending. */
export async function cancelDeletion(userId: string): Promise<boolean> {
  return (await getRedis().zrem(PENDING_KEY, userId)) > 0;
}

/** Deletes the accounts whose grace period is over, leaving each of their apps a tombstone. How many went. */
export async function purgeDueAccounts(now = Date.now()): Promise<number> {
  const redis = getRedis();
  const dueUserIds = await redis.zrange<string[]>(PENDING_KEY, 0, now, { byScore: true });
  for (const userId of dueUserIds) await purgeAccount(userId, now);
  return dueUserIds.length;
}

async function purgeAccount(userId: string, now: number): Promise<void> {
  const redis = getRedis();
  const appIds = await appsThatKnew(userId);
  // Cascades to passkeys, sessions, refresh tokens, app links and the photo.
  await prisma.user.deleteMany({ where: { id: userId } });
  await Promise.all(appIds.map((clientId) => redis.zadd(tombstonesKey(clientId), { score: now, member: userId })));
  await redis.zrem(PENDING_KEY, userId);
}

/** Apps linked to the account, or that still hold its tokens (a link revoked earlier leaves the app's own data behind). */
async function appsThatKnew(userId: string): Promise<string[]> {
  const [memberships, tokens] = await Promise.all([
    prisma.appMembership.findMany({ where: { userId }, select: { clientId: true } }),
    prisma.refreshToken.findMany({ where: { userId }, select: { clientId: true }, distinct: ["clientId"] }),
  ]);
  return [...new Set([...memberships, ...tokens].map(({ clientId }) => clientId))];
}

/** The subs of this app's accounts deleted since `since` (ms), for it to delete their data too. */
export async function deletedAccountsOf(clientDbId: string, since: number): Promise<string[]> {
  return getRedis().zrange<string[]>(tombstonesKey(clientDbId), since, "+inf", { byScore: true });
}

/** Tombstones older than TOMBSTONE_DAYS: every app has had time to read them. */
export async function pruneTombstones(now = Date.now()): Promise<void> {
  const redis = getRedis();
  const clients = await prisma.client.findMany({ select: { id: true } });
  await Promise.all(clients.map(({ id }) => redis.zremrangebyscore(tombstonesKey(id), 0, now - TOMBSTONE_DAYS * DAY_MS)));
}

/** The oldest `since` an app may ask for. */
export const oldestTombstone = (now = Date.now()) => now - TOMBSTONE_DAYS * DAY_MS;
