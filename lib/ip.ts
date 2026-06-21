import "server-only";
import { headers } from "next/headers";

function isValidIp(ip: string): boolean {
  const ipv4Regex =
    /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
  const ipv6Regex =
    /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$|^([0-9a-fA-F]{1,4}:){1,7}:$/;

  return (
    ipv4Regex.test(ip) ||
    ipv6Regex.test(ip) ||
    ip === "::1" ||
    ip === "127.0.0.1"
  );
}

export async function getClientIp(): Promise<string> {
  const headerList = await headers();

  const ipSources = [
    "x-real-ip",
    "x-forwarded-for",
    "x-client-ip",
    "x-vercel-forwarded-for",
    "cf-connecting-ip",
    "fastly-client-ip",
    "true-client-ip",
  ];

  for (const name of ipSources) {
    const rawIp = headerList.get(name);
    if (!rawIp) continue;

    const firstIp = rawIp.split(",")[0]?.trim();
    if (firstIp && isValidIp(firstIp)) return firstIp;
  }

  return "unknown";
}
