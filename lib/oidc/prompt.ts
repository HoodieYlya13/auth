const PROMPTS = ["none", "login", "consent", "select_account"] as const;

export type Prompt = (typeof PROMPTS)[number];

function isPrompt(value: string): value is Prompt {
  return (PROMPTS as readonly string[]).includes(value);
}

/** The requested prompt values, or null when "none" is combined with another (OIDC Core §3.1.2.1). */
export function parsePrompt(value: string | null | undefined): Set<Prompt> | null {
  const prompts = new Set((value ?? "").split(/\s+/).filter(isPrompt));
  if (prompts.has("none") && prompts.size > 1) return null;
  return prompts;
}

/** An authorize path without its prompt, for continuing once the prompt has been answered. */
export function withoutPrompt(authorizePath: string): string {
  const url = new URL(authorizePath, "http://authorize.invalid");
  url.searchParams.delete("prompt");
  return url.pathname + url.search;
}
