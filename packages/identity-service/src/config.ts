export type IdentityConfig = {
  port: number;
  oidcIssuerUrl: string;
  oidcClientId: string;
  oidcClientSecret: string;
  oidcRedirectUri: string;
  jwtIssuer: string;
  jwtAudience: string;
  jwtSecret: string;
  tenantDefaultId: string;
  tenantDefaultWorkspaceId: string;
  databaseUrl?: string;
};

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return value;
};

export const loadConfig = (): IdentityConfig => ({
  port: Number(process.env.PORT ?? 4001),
  oidcIssuerUrl: requireEnv("OIDC_ISSUER_URL"),
  oidcClientId: requireEnv("OIDC_CLIENT_ID"),
  oidcClientSecret: requireEnv("OIDC_CLIENT_SECRET"),
  oidcRedirectUri: requireEnv("OIDC_REDIRECT_URI"),
  jwtIssuer: process.env.JWT_ISSUER ?? "openclaw-identity",
  jwtAudience: process.env.JWT_AUDIENCE ?? "openclaw-api",
  jwtSecret: requireEnv("JWT_SECRET"),
  tenantDefaultId: process.env.TENANT_DEFAULT_ID ?? "default",
  tenantDefaultWorkspaceId: process.env.TENANT_DEFAULT_WORKSPACE_ID ?? "default",
  databaseUrl: process.env.DATABASE_URL,
});
