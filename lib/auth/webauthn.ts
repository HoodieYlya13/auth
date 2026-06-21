import "server-only";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type AuthenticatorTransportFuture,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { prisma } from "@/lib/db";
import { getRedis } from "@/lib/redis";

const RP_ID = process.env.RP_ID ?? "localhost";
const RP_NAME = "Auth";
const ORIGIN = process.env.ISSUER ?? "http://localhost:3000";
const CHALLENGE_TTL = 300; // 5 minutes

const regKey = (userId: string) => `wa:reg:${userId}`;
const authKey = (flowId: string) => `wa:auth:${flowId}`;

export async function startPasskeyRegistration(user: {
  id: string;
  email: string;
  username: string | null;
}): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const existing = await prisma.credential.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.username ?? user.email,
    userDisplayName: user.username ?? user.email,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((c) => ({
      id: c.credentialId,
      transports: c.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: {
      residentKey: "preferred",
      userVerification: "preferred",
    },
  });

  await getRedis().set(regKey(user.id), options.challenge, {
    ex: CHALLENGE_TTL,
  });
  return options;
}

export async function finishPasskeyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  label?: string,
): Promise<void> {
  const redis = getRedis();
  const expectedChallenge = await redis.get<string>(regKey(userId));
  if (!expectedChallenge) throw new Error("Registration challenge expired");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
  });
  await redis.del(regKey(userId));

  if (!verification.verified || !verification.registrationInfo)
    throw new Error("Passkey registration could not be verified");

  const { credential, credentialDeviceType, credentialBackedUp } =
    verification.registrationInfo;

  await prisma.credential.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: BigInt(credential.counter),
      transports: credential.transports ?? [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
      name: label?.trim() || null,
    },
  });
}

export async function startPasskeyAuthentication(): Promise<{
  options: PublicKeyCredentialRequestOptionsJSON;
  flowId: string;
}> {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "preferred",
  });
  const flowId = crypto.randomUUID();
  await getRedis().set(authKey(flowId), options.challenge, {
    ex: CHALLENGE_TTL,
  });
  return { options, flowId };
}

export async function finishPasskeyAuthentication(
  flowId: string,
  response: AuthenticationResponseJSON,
): Promise<string> {
  const redis = getRedis();
  const expectedChallenge = await redis.get<string>(authKey(flowId));
  if (!expectedChallenge) throw new Error("Authentication challenge expired");
  await redis.del(authKey(flowId));

  const credential = await prisma.credential.findUnique({
    where: { credentialId: response.id },
  });
  if (!credential) throw new Error("Unknown passkey");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: false,
    credential: {
      id: credential.credentialId,
      publicKey: new Uint8Array(credential.publicKey),
      counter: Number(credential.counter),
      transports: credential.transports as AuthenticatorTransportFuture[],
    },
  });

  if (!verification.verified) throw new Error("Passkey could not be verified");

  await prisma.credential.update({
    where: { id: credential.id },
    data: {
      counter: BigInt(verification.authenticationInfo.newCounter),
      lastUsedAt: new Date(),
    },
  });

  return credential.userId;
}
