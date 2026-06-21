import "server-only";

const ISSUER = process.env.ISSUER ?? "";

const endpoints = {
  issuer: ISSUER,
  authorization: `${ISSUER}/api/oidc/authorize`,
  token: `${ISSUER}/api/oidc/token`,
  userinfo: `${ISSUER}/api/oidc/userinfo`,
  jwks: `${ISSUER}/.well-known/jwks.json`,
  endSession: `${ISSUER}/api/oidc/logout`,
} as const;

export const SUPPORTED_SCOPES = [
  "openid",
  "profile",
  "email",
  "offline_access",
];

export function getDiscoveryDocument() {
  return {
    issuer: endpoints.issuer,
    authorization_endpoint: endpoints.authorization,
    token_endpoint: endpoints.token,
    userinfo_endpoint: endpoints.userinfo,
    jwks_uri: endpoints.jwks,
    end_session_endpoint: endpoints.endSession,
    response_types_supported: ["code"],
    response_modes_supported: ["query"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: [process.env.JWT_ALG ?? "RS256"],
    token_endpoint_auth_methods_supported: [
      "client_secret_basic",
      "client_secret_post",
      "none",
    ],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: SUPPORTED_SCOPES,
    claims_supported: [
      "sub",
      "iss",
      "aud",
      "exp",
      "iat",
      "email",
      "email_verified",
      "preferred_username",
      "given_name",
      "family_name",
      "name",
      "birthdate",
      "roles",
      "admin",
    ],
  };
}
