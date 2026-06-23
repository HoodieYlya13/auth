# HY13 Passkey SSO — self-hosted OIDC identity provider

A small, self-hosted **OpenID Connect** identity provider ("mini-Keycloak") for first-
and third-party apps. Users authenticate once here with a **passkey** or **magic link**,
then get redirected back to the calling app with standard OIDC tokens whose access token
carries their identity and **per-app roles**.

## Stack

- **Next.js 16** (App Router, `cacheComponents`, React 19) on **bun**
- **Prisma 7** + PostgreSQL (Neon) via the `@prisma/adapter-pg` driver adapter, UUIDv7 ids
- **jose** for RS256 JWT signing + JWKS
- **@simplewebauthn** for passkeys, **Resend** for magic-link email
- **Upstash Redis** for ephemeral state (challenges, magic-link tokens, auth codes) + rate limiting
- **Cloudflare Turnstile** captcha, i18n (`en` / `fr`)

## How it works

- **Auth methods.** A magic link verifies the email and creates the account; the user then
  adds a passkey for fast future logins. Login sets an httpOnly session cookie (DB-backed,
  revocable).
- **Registration gate.** A user must set a **username** (first/last name and birthday are
  optional) before they can be redirected to any app.
- **OIDC.** Authorization Code + PKCE (S256 only), RS256 signed tokens, discovery + JWKS.
  Access tokens are self-contained (identity claims + `roles` for the audience app +
  `admin`), ~15 min TTL. Refresh tokens rotate with **reuse detection** (replay revokes the
  whole family).
- **Consent.** First time a user links a non-`trusted` app they approve a consent screen;
  the link is remembered and revocable from account settings. `trusted` first-party apps
  skip consent.
- **Roles.** Per-app roles from a per-client list, assigned by the admin. The configured
  `ADMIN_EMAIL` is `admin: true` everywhere (computed from env, never stored).
- **Admin dashboard** (`/[lang]/admin`, gated to `ADMIN_EMAIL`): register apps (redirect
  URIs, trusted flag, per-app roles, optional client secret) and assign user roles.

## Endpoints

| Endpoint | Path |
| --- | --- |
| Discovery | `/.well-known/openid-configuration` |
| JWKS | `/.well-known/jwks.json` |
| Authorize | `/api/oidc/authorize` |
| Token | `/api/oidc/token` |
| UserInfo | `/api/oidc/userinfo` |
| End session | `/api/oidc/logout` |

## Setup

```bash
bun install
cp .env.example .env.local   # then fill in the values
bunx prisma migrate dev      # apply schema to the database
bun run dev                  # http://localhost:3000
```

`ISSUER` must equal the public origin (e.g. `http://localhost:3000`) — it is used as the
token issuer and to build endpoint URLs. RS256 keys live in `.env.local` as base64-encoded
PEM (`OIDC_PRIVATE_KEY` / `OIDC_PUBLIC_KEY` / `OIDC_KEY_ID`).

## Verify

With the dev server running:

```bash
bun scripts/verify-oidc.mjs        # full flow, 29 checks (BASE_URL= to override port)
npx fallow                         # dead-code / duplication / health
```

`verify-oidc.mjs` drives discovery + JWKS, magic-link login, the consent gate, the
PKCE authorize → code → token exchange, token validation against JWKS, userinfo, refresh
rotation, and refresh reuse-detection, cleaning up its test data afterward.
