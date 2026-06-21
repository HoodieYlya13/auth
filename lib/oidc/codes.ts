import "server-only";
import { getRedis } from "@/lib/redis";
import { randomToken, safeEqual, sha256Base64Url } from "@/lib/crypto";

const TTL = 60;
const PREFIX = "oidc:code:";

export interface AuthCode {
  userId: string;
  clientId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  nonce?: string;
  authTime: number;
}

export async function issueAuthCode(data: AuthCode): Promise<string> {
  const code = randomToken();
  await getRedis().set(`${PREFIX}${code}`, data, { ex: TTL });
  return code;
}

export async function consumeAuthCode(code: string): Promise<AuthCode | null> {
  const redis = getRedis();
  const key = `${PREFIX}${code}`;
  const data = await redis.get<AuthCode>(key);
  if (!data) return null;
  await redis.del(key);
  return data;
}

export function verifyPkce(verifier: string, challenge: string): boolean {
  return safeEqual(sha256Base64Url(verifier), challenge);
}
