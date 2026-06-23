import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRedisOrNull } from "@/lib/redis";
import { tryCatch } from "@/lib/utils";

function reason(error: Error): string {
  return error.message || "Unknown error";
}

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret)
    return NextResponse.json(
      { error: "CRON_SECRET environment variable is not configured." },
      { status: 500 },
    );

  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${cronSecret}`)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const results: {
    postgres?: string;
    redis?: string;
    cleanup?: string;
  } = {};

  const redis = getRedisOrNull();
  if (redis) {
    const [error] = await tryCatch(redis.ping());
    results.redis = error
      ? `Redis ping failed: ${reason(error)}`
      : "Redis pinged successfully.";
  } else results.redis = "Redis credentials not found, ping skipped.";

  const [pgError] = await tryCatch(prisma.$queryRaw`SELECT 1`);
  results.postgres = pgError
    ? `Postgres ping failed: ${reason(pgError)}`
    : "Postgres pinged successfully.";

  const now = new Date();
  const unconfirmedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const [cleanupError, counts] = await tryCatch(
    prisma.$transaction([
      prisma.user.deleteMany({
        where: {
          username: null,
          createdAt: { lt: unconfirmedCutoff },
          credentials: { none: {} },
        },
      }),
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]),
  );

  if (cleanupError || !counts) {
    results.cleanup = `Cleanup failed: ${
      cleanupError ? reason(cleanupError) : "Unknown error"
    }`;
  } else {
    const [users, sessions, refreshTokens] = counts;
    results.cleanup = `Wiped ${users.count} unconfirmed users, ${sessions.count} expired sessions, ${refreshTokens.count} expired refresh tokens.`;
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
