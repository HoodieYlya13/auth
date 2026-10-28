// No "server-only": proxy.ts uses it too.

const BASE = "http://return-to.invalid";

/**
 * A `return_to` that stays on this site, normalized to a path (or undefined).
 * A prefix check isn't enough: browsers read `/\evil.com` or `/<tab>/evil.com`
 * as `//evil.com`, another site. So the value is parsed like a browser would,
 * and kept only if it resolves to this origin.
 */
export function safeReturnTo(
  value: string | null | undefined,
): string | undefined {
  if (typeof value !== "string" || !value.startsWith("/")) return undefined;
  // Backslashes and control characters (tabs, newlines) are how the tricks above work.
  if (/[\\\u0000-\u001f\u007f]/.test(value)) return undefined;
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return undefined;
  }
  if (url.origin !== BASE) return undefined;
  const path = url.pathname + url.search + url.hash;
  // "/.//evil.com" normalizes to "//evil.com": still another site once in a Location header.
  return path.startsWith("//") ? undefined : path;
}
