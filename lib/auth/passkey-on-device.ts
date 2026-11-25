// No "server-only": the sign-in form and the passkey pages read and write it in the browser.

const PASSKEY_ON_DEVICE_KEY = "passkey-on-device";

/**
 * Whether a passkey on this device (synced ones included) signed in or was
 * created here before. Kept in this browser's storage, never sent anywhere:
 * the passkey button then goes straight to the passkey prompt instead of
 * asking for the email first.
 */
export function hasPasskeyOnDevice(): boolean {
  try {
    return localStorage.getItem(PASSKEY_ON_DEVICE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Remembered only for a passkey on this device ("platform"): one used from a
 * phone through a QR code ("cross-platform") would only bring the QR code back.
 */
export function rememberPasskeyOnDevice(authenticatorAttachment: string | undefined) {
  if (authenticatorAttachment !== "platform") return;
  try {
    localStorage.setItem(PASSKEY_ON_DEVICE_KEY, "1");
  } catch {}
}

/** Its passkey was deleted or isn't found here any more: the next sign-in asks for the email again. */
export function forgetPasskeyOnDevice() {
  try {
    localStorage.removeItem(PASSKEY_ON_DEVICE_KEY);
  } catch {}
}
