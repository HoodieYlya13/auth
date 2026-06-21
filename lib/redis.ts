import "server-only";
import { Redis } from "@upstash/redis";

let cached: Redis | null | undefined;

export function getRedisOrNull(): Redis | null {
  if (cached !== undefined) return cached;

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "⚠️ UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not found. Redis-backed features are disabled.",
      );
      cached = null;
      return null;
    }
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.",
    );
  }

  cached = new Redis({ url, token });
  return cached;
}

export function getRedis(): Redis {
  const client = getRedisOrNull();
  if (!client)
    throw new Error(
      "Redis is not configured (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN).",
    );
  return client;
}
