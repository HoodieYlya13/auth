import "server-only";
import { exportJWK, importPKCS8, importSPKI, type JWK } from "jose";

export const SIGNING_ALG = process.env.JWT_ALG ?? "RS256";
export const SIGNING_KID = process.env.OIDC_KEY_ID ?? "";

function decodePem(b64: string | undefined, label: string): string {
  if (!b64) throw new Error(`Missing ${label} in environment`);
  return Buffer.from(b64, "base64").toString("utf8");
}

let privateKey: ReturnType<typeof importPKCS8> | null = null;
let publicKey: ReturnType<typeof importSPKI> | null = null;
let jwks: Promise<{ keys: JWK[] }> | null = null;

export function getPrivateKey() {
  privateKey ??= importPKCS8(
    decodePem(process.env.OIDC_PRIVATE_KEY, "OIDC_PRIVATE_KEY"),
    SIGNING_ALG,
  );
  return privateKey;
}

export function getPublicKey() {
  publicKey ??= importSPKI(
    decodePem(process.env.OIDC_PUBLIC_KEY, "OIDC_PUBLIC_KEY"),
    SIGNING_ALG,
  );
  return publicKey;
}

export function getJwks() {
  jwks ??= (async () => {
    const jwk = await exportJWK(await getPublicKey());
    jwk.kid = SIGNING_KID;
    jwk.alg = SIGNING_ALG;
    jwk.use = "sig";
    return { keys: [jwk] };
  })();
  return jwks;
}
