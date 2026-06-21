import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getClientIp } from "@/lib/ip";

export class RateLimitError extends Error {
  constructor() {
    super("TOO_MANY_REQUESTS");
    this.name = "RateLimitError";
  }
}

function getRedisClient(): Redis | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "⚠️ UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN not found. Rate limiting will be disabled.",
      );
      return null;
    }
    throw new Error(
      "UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are required in production.",
    );
  }

  return new Redis({ url, token });
}

function getLimiter(identifier: string, redis: Redis) {
  switch (identifier) {
    case "auth":
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, "1 m"),
        prefix: "rl:ip",
      });
    default:
      return new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, "1 m"),
        prefix: "rl:ip",
      });
  }
}

function getGlobalBudget(identifier: string, redis: Redis) {
  if (identifier !== "auth") return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(500, "1 d"),
    prefix: "rl:budget",
  });
}

export async function isRepeatSubmission(identifier: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) return false;

  const ip = await getClientIp();
  const softLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(1, "1 m"),
    prefix: "rl:soft",
  });

  const { success } = await softLimiter.limit(`${identifier}-${ip}`);
  return !success;
}

export async function checkRateLimit(identifier: string): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;

  const ip = await getClientIp();
  const limiter = getLimiter(identifier, redis);
  const { success } = await limiter.limit(`${identifier}-${ip}`);
  if (!success) throw new RateLimitError();

  const budget = getGlobalBudget(identifier, redis);
  if (budget) {
    const { success: withinBudget } = await budget.limit(identifier);
    if (!withinBudget) throw new RateLimitError();
  }
}
