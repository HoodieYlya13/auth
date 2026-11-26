import { hasLocale } from "@/lib/dictionaries/dictionaries";

const ISSUER = process.env.ISSUER ?? "http://localhost:3000";

/** The account page, in an email's language. */
export const accountPageUrl = (locale: string) => `${ISSUER}/${hasLocale(locale) ? locale : "en"}/account`;
