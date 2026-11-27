"use client";

import { useEffect } from "react";

const pageTraceId = Math.random().toString(36).slice(2, 8);

/** Temporary: reports one step of the sign-in page to the server logs, with the time since the page opened. */
export function tracePasskey(event: string, details: Record<string, unknown> = {}): void {
  const trace = { id: pageTraceId, atMs: Math.round(performance.now()), event, ...details };
  console.log("[passkey-trace]", trace);
  void fetch("/api/passkey-trace", { method: "POST", body: JSON.stringify(trace), keepalive: true }).catch(() => {});
}

function describeElement(element: Element | null): string {
  if (!element) return "none";
  return element.id ? `${element.tagName.toLowerCase()}#${element.id}` : element.tagName.toLowerCase();
}

function traceFocusChange(event: FocusEvent): void {
  const target = event.target instanceof Element ? event.target : null;
  tracePasskey(event.type, {
    target: describeElement(target),
    isTrusted: event.isTrusted,
    autocomplete: target?.getAttribute("autocomplete") ?? null,
    active: describeElement(document.activeElement),
  });
}

function traceCredentialRequests(): () => void {
  const credentials = navigator.credentials;
  const originalGet = credentials.get.bind(credentials);
  credentials.get = async (options?: CredentialRequestOptions) => {
    const emailField = document.getElementById("email");
    tracePasskey("credentials.get called", {
      mediation: options?.mediation ?? "default",
      emailAutocomplete: emailField?.getAttribute("autocomplete") ?? null,
      active: describeElement(document.activeElement),
    });
    options?.signal?.addEventListener("abort", () =>
      tracePasskey("credentials.get aborted", { reason: String(options.signal?.reason) }),
    );
    try {
      const credential = await originalGet(options);
      tracePasskey("credentials.get resolved", { hasCredential: credential !== null });
      return credential;
    } catch (error) {
      const failure = error instanceof Error ? { name: error.name, message: error.message } : { message: String(error) };
      tracePasskey("credentials.get rejected", failure);
      throw error;
    }
  };
  return () => {
    credentials.get = originalGet;
  };
}

function tracePageVisibility(): void {
  tracePasskey("visibilitychange", { state: document.visibilityState });
}

function tracePageShow(event: PageTransitionEvent): void {
  tracePasskey(event.type, { persisted: event.persisted });
}

/** Temporary: traces focus, visibility and every passkey request on the sign-in page. */
export function useSignInPageTrace(): void {
  useEffect(() => {
    tracePasskey("sign-in page ready", { active: describeElement(document.activeElement), referrer: document.referrer });
    const stopTracingCredentials = traceCredentialRequests();
    document.addEventListener("focusin", traceFocusChange);
    document.addEventListener("focusout", traceFocusChange);
    document.addEventListener("visibilitychange", tracePageVisibility);
    window.addEventListener("pageshow", tracePageShow);
    window.addEventListener("pagehide", tracePageShow);
    return () => {
      stopTracingCredentials();
      document.removeEventListener("focusin", traceFocusChange);
      document.removeEventListener("focusout", traceFocusChange);
      document.removeEventListener("visibilitychange", tracePageVisibility);
      window.removeEventListener("pageshow", tracePageShow);
      window.removeEventListener("pagehide", tracePageShow);
    };
  }, []);
}
