import { hasLocale } from "@/lib/dictionaries/dictionaries";

const ISSUER = process.env.ISSUER ?? "http://localhost:3000";

const localePrefix = (locale: string) => `${ISSUER}/${hasLocale(locale) ? locale : "en"}`;

/** The account page, in an email's language. */
export const accountPageUrl = (locale: string) => `${localePrefix(locale)}/account`;

/** Where the former address gives the account back to itself. */
export const claimBackUrl = (locale: string, token: string) => `${localePrefix(locale)}/claim-back?token=${encodeURIComponent(token)}`;
