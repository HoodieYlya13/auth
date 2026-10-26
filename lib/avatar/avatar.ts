import "server-only";

const ISSUER = process.env.ISSUER ?? "";

export const AVATAR_MAX_BYTES = 512 * 1024;

// Sniff the actual image format rather than trusting the client-declared type.
export function detectImageType(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  )
    return "image/png";
  if (
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

// Versioned so clients and browsers can cache the image forever.
export function avatarPath(user: {
  id: string;
  avatarUpdatedAt: Date | null;
}): string | null {
  if (!user.avatarUpdatedAt) return null;
  return `/api/avatar/${user.id}?v=${user.avatarUpdatedAt.getTime()}`;
}

export function avatarUrl(user: {
  id: string;
  avatarUpdatedAt: Date | null;
}): string | null {
  const path = avatarPath(user);
  return path ? `${ISSUER}${path}` : null;
}
