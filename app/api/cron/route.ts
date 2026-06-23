import { type NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRedisOrNull } from "@/lib/redis";

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
    try {
      await redis.ping();
      results.redis = "Redis pinged successfully.";
    } catch (err: unknown) {
      results.redis = `Redis ping failed: ${
        err instanceof Error ? err.message : "Unknown error"
      }`;
    }
  } else results.redis = "Redis credentials not found, ping skipped.";

  try {
    await prisma.$queryRaw`SELECT 1`;
    results.postgres = "Postgres pinged successfully.";
  } catch (err: unknown) {
    results.postgres = `Postgres ping failed: ${
      err instanceof Error ? err.message : "Unknown error"
    }`;
  }

  try {
    const now = new Date();
    const unconfirmedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [users, sessions, refreshTokens] = await prisma.$transaction([
      prisma.user.deleteMany({
        where: {
          username: null,
          createdAt: { lt: unconfirmedCutoff },
          credentials: { none: {} },
        },
      }),
      prisma.session.deleteMany({ where: { expiresAt: { lt: now } } }),
      prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: now } } }),
    ]);

    results.cleanup = `Wiped ${users.count} unconfirmed users, ${sessions.count} expired sessions, ${refreshTokens.count} expired refresh tokens.`;
  } catch (err: unknown) {
    results.cleanup = `Cleanup failed: ${
      err instanceof Error ? err.message : "Unknown error"
    }`;
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    results,
  });
}
