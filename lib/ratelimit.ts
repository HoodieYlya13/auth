import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getClientIp } from "@/lib/ip";
import { getRedisOrNull } from "@/lib/redis";

export class RateLimitError extends Error {
  constructor() {
    super("TOO_MANY_REQUESTS");
    this.name = "RateLimitError";
  }
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
  const redis = getRedisOrNull();
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
  const redis = getRedisOrNull();
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
