import "server-only";
import { cookies } from "next/headers";
import { getRedis } from "@/lib/redis";
import { randomToken } from "@/lib/crypto";

const DEVICE_COOKIE = "auth_device";
/** Browsers keep a cookie at most about this long. */
const REMEMBERED_SECONDS = 400 * 24 * 60 * 60;
const devicesKey = (userId: string) => `known-devices:${userId}`;

/**
 * Whether this browser is new to the account, and remembers it either way.
 * An account with no device remembered yet (its first sign-in, or the first
 * since this began) has nothing to compare with: not new.
 */
export async function isNewDeviceFor(userId: string): Promise<boolean> {
  const store = await cookies();
  const deviceId = store.get(DEVICE_COOKIE)?.value ?? randomToken(16);
  store.set(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: REMEMBERED_SECONDS,
  });

  const redis = getRedis();
  const key = devicesKey(userId);
  const [isKnown, knownCount] = await Promise.all([redis.sismember(key, deviceId), redis.scard(key)]);
  await redis.sadd(key, deviceId);
  await redis.expire(key, REMEMBERED_SECONDS);
  return !isKnown && knownCount > 0;
}
