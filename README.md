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
- **Upstash Redis** for ephemeral state (challenges, magic-link tokens and codes, auth codes) + rate limiting
- **Cloudflare Turnstile** captcha, i18n (`en` / `fr`)

## How it works

- **Auth methods.** A magic link verifies the email and creates the account. The email
  also carries a 6-digit code to type on the sign-in page instead (single use, newest code
  only, five wrong tries end it), for whoever would rather not open the link in a new tab. The user is
  then offered a passkey for fast future logins, and again once a day per browser while they
  have none: on an email sign-in, the first page they load, or on the way into an app, then
  back to where they were headed. Login sets an httpOnly session cookie
  (DB-backed, revocable).
- **Registration gate.** A user must set a **username** (first/last name and birthday are
  optional) before they can be redirected to any app.
- **OIDC.** Authorization Code + PKCE (S256 only), RS256 signed tokens, discovery + JWKS.
  Browser apps (public clients) may call the token and userinfo endpoints from the
  origins of their registered redirect URIs (CORS); confidential clients never from a browser.
  Access tokens are self-contained (identity claims + `roles` for the audience app +
  `admin`), ~15 min TTL. Tokens and userinfo carry `no_passkey: true` while the account has
  no passkey (left out once it has one), so apps can suggest adding one. Refresh tokens rotate with **reuse detection** (replay revokes the
  whole family).
- **Back-Channel Logout** (OIDC Back-Channel Logout 1.0). ID tokens carry `sid`, the
  sign-in they belong to. When a sign-in ends (signing out, the logout endpoint, or
  revoking a device on the account page), every app that holds a refresh token from it and
  registered a back-channel logout URI receives a `logout+jwt` logout token by POST, so it
  ends its own session at once instead of at its next refresh. Delivery waits at most
  5 s per app, and one failing app never blocks the others.
- **Consent.** First time a user links a non-`trusted` app they approve a consent screen;
  the link is remembered and revocable from account settings. `trusted` first-party apps
  skip consent, but on first use the user confirms the account ("Continue as …"), unless
  they signed in moments ago. Both screens offer "Use another account".
- **`prompt`.** `none` never shows a page (returns `login_required`,
  `interaction_required` or `consent_required`), `login` forces a fresh sign-in,
  `select_account` and `consent` force the confirmation screen.
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
bun scripts/verify-oidc.mjs        # full flow, 37 checks (BASE_URL= to override port)
npx fallow                         # dead-code / duplication / health
```

`verify-oidc.mjs` drives discovery + JWKS, magic-link login, the consent gate, the
PKCE authorize → code → token exchange, token validation against JWKS, userinfo, CORS for browser apps, refresh
rotation, refresh reuse-detection, and back-channel logout (a local listener receives the
logout token and checks it against JWKS), cleaning up its test data afterward.
