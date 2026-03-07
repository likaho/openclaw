import { SignJWT, jwtVerify } from "jose";

export type TokenClaims = {
  tenantId: string;
  workspaceId: string;
  subject: string;
  roles: string[];
  entitlements?: string[];
  tokenUse: "access" | "refresh";
};

export type TokenConfig = {
  issuer: string;
  audience: string;
  secret: string;
};

const toSecret = (secret: string): Uint8Array => new TextEncoder().encode(secret);

const assertTokenClaims = (payload: unknown, tokenUse: TokenClaims["tokenUse"]): TokenClaims => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Token payload missing");
  }
  const record = payload as Record<string, unknown>;
  if (
    typeof record.tenantId !== "string" ||
    typeof record.workspaceId !== "string" ||
    typeof record.sub !== "string" ||
    !Array.isArray(record.roles)
  ) {
    throw new Error("Token payload invalid");
  }
  if (record.tokenUse !== tokenUse) {
    throw new Error("Token use mismatch");
  }
  return {
    tenantId: record.tenantId,
    workspaceId: record.workspaceId,
    subject: record.sub,
    roles: record.roles.filter((role) => typeof role === "string"),
    entitlements: Array.isArray(record.entitlements)
      ? record.entitlements.filter((entitlement) => typeof entitlement === "string")
      : undefined,
    tokenUse,
  };
};

const buildToken = async (
  claims: Omit<TokenClaims, "tokenUse">,
  tokenUse: TokenClaims["tokenUse"],
  config: TokenConfig,
  expiresIn: string,
): Promise<string> => {
  return new SignJWT({
    tenantId: claims.tenantId,
    workspaceId: claims.workspaceId,
    roles: claims.roles,
    entitlements: claims.entitlements,
    tokenUse,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuer(config.issuer)
    .setAudience(config.audience)
    .setSubject(claims.subject)
    .setExpirationTime(expiresIn)
    .sign(toSecret(config.secret));
};

export const issueAccessToken = (
  claims: Omit<TokenClaims, "tokenUse">,
  config: TokenConfig,
  expiresIn = "15m",
): Promise<string> => buildToken(claims, "access", config, expiresIn);

export const issueRefreshToken = (
  claims: Omit<TokenClaims, "tokenUse">,
  config: TokenConfig,
  expiresIn = "7d",
): Promise<string> => buildToken(claims, "refresh", config, expiresIn);

export const verifyAccessToken = async (
  token: string,
  config: TokenConfig,
): Promise<TokenClaims> => {
  const { payload } = await jwtVerify(token, toSecret(config.secret), {
    issuer: config.issuer,
    audience: config.audience,
  });
  return assertTokenClaims(payload, "access");
};

export const verifyRefreshToken = async (
  token: string,
  config: TokenConfig,
): Promise<TokenClaims> => {
  const { payload } = await jwtVerify(token, toSecret(config.secret), {
    issuer: config.issuer,
    audience: config.audience,
  });
  return assertTokenClaims(payload, "refresh");
};
