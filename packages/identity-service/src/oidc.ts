import { createRemoteJWKSet, jwtVerify } from "jose";
import type { IdentityConfig } from "./config.js";
import type { OidcClaims } from "./tenant.js";

type OpenIdConfiguration = {
  issuer: string;
  jwks_uri: string;
  token_endpoint: string;
};

type TokenResponse = {
  access_token: string;
  id_token: string;
  expires_in: number;
  refresh_token?: string;
};

let cachedConfig: { value: OpenIdConfiguration; expiresAt: number } | null = null;

const getOpenIdConfiguration = async (issuerUrl: string): Promise<OpenIdConfiguration> => {
  const now = Date.now();
  if (cachedConfig && cachedConfig.expiresAt > now) {
    return cachedConfig.value;
  }
  const discoveryUrl = new URL(".well-known/openid-configuration", `${issuerUrl}/`);
  const response = await fetch(discoveryUrl);
  if (!response.ok) {
    throw new Error(`Failed OIDC discovery: ${response.status}`);
  }
  const value = (await response.json()) as OpenIdConfiguration;
  cachedConfig = { value, expiresAt: now + 5 * 60 * 1000 };
  return value;
};

export const exchangeCodeForTokens = async (
  config: IdentityConfig,
  code: string,
  redirectUri: string,
): Promise<TokenResponse> => {
  const openIdConfig = await getOpenIdConfiguration(config.oidcIssuerUrl);
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.oidcClientId,
    client_secret: config.oidcClientSecret,
    redirect_uri: redirectUri,
    code,
  });

  const response = await fetch(openIdConfig.token_endpoint, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token exchange failed: ${response.status} ${errorText}`);
  }

  return (await response.json()) as TokenResponse;
};

export const verifyIdToken = async (
  config: IdentityConfig,
  idToken: string,
): Promise<OidcClaims> => {
  const openIdConfig = await getOpenIdConfiguration(config.oidcIssuerUrl);
  const jwks = createRemoteJWKSet(new URL(openIdConfig.jwks_uri));
  const { payload } = await jwtVerify(idToken, jwks, {
    issuer: openIdConfig.issuer,
    audience: config.oidcClientId,
  });
  return payload as OidcClaims;
};
