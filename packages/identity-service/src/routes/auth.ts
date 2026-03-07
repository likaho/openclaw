import type { Request, Response, Router } from "express";
import { json, Router as createRouter } from "express";
import type { IdentityConfig } from "../config.js";
import { exchangeCodeForTokens, verifyIdToken } from "../oidc.js";
import {
  createInMemorySessionStore,
  createInMemoryStateStore,
  hashToken,
} from "../store.js";
import { resolveTenantFromClaims } from "../tenant.js";
import {
  issueAccessToken,
  issueRefreshToken,
  verifyRefreshToken,
  type TokenClaims,
} from "../tokens.js";

type AuthSession = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tenantId: string;
  workspaceId: string;
  subject: string;
  roles: string[];
  entitlements?: string[];
};

const toTokenConfig = (config: IdentityConfig) => ({
  issuer: config.jwtIssuer,
  audience: config.jwtAudience,
  secret: config.jwtSecret,
});

const buildLoginUrl = (config: IdentityConfig, state: string, redirectUri: string): string => {
  const loginUrl = new URL(`${config.oidcIssuerUrl}/protocol/openid-connect/auth`);
  loginUrl.searchParams.set("client_id", config.oidcClientId);
  loginUrl.searchParams.set("response_type", "code");
  loginUrl.searchParams.set("scope", "openid profile email");
  loginUrl.searchParams.set("redirect_uri", redirectUri);
  loginUrl.searchParams.set("state", state);
  return loginUrl.toString();
};

const refreshTtlMs = 7 * 24 * 60 * 60 * 1000;

const buildSession = async (
  claims: Omit<TokenClaims, "tokenUse">,
  config: IdentityConfig,
): Promise<AuthSession> => {
  const tokenConfig = toTokenConfig(config);
  const accessToken = await issueAccessToken(claims, tokenConfig);
  const refreshToken = await issueRefreshToken(claims, tokenConfig);
  return {
    accessToken,
    refreshToken,
    expiresIn: 900,
    tenantId: claims.tenantId,
    workspaceId: claims.workspaceId,
    subject: claims.subject,
    roles: claims.roles,
    entitlements: claims.entitlements,
  };
};

export const createAuthRouter = (config: IdentityConfig): Router => {
  const router = createRouter();
  const sessionStore = createInMemorySessionStore();
  const stateStore = createInMemoryStateStore();

  router.post("/login", json(), (req: Request, res: Response) => {
    const tenantHint = typeof req.body?.tenantHint === "string" ? req.body.tenantHint : undefined;
    const redirectUri =
      typeof req.body?.redirectUri === "string" ? req.body.redirectUri : config.oidcRedirectUri;
    const stateRecord = stateStore.createState({ tenantHint, redirectUri });
    const redirectUrl = buildLoginUrl(config, stateRecord.state, redirectUri);
    res.status(200).json({ redirectUrl, tenantHint });
  });

  router.get("/callback", async (req: Request, res: Response) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    if (!code) {
      res.status(400).json({ error: "missing_code" });
      return;
    }
    if (!state) {
      res.status(400).json({ error: "missing_state" });
      return;
    }

    const stateRecord = stateStore.consumeState(state);
    if (!stateRecord) {
      res.status(400).json({ error: "invalid_state" });
      return;
    }

    try {
      const tokenResponse = await exchangeCodeForTokens(config, code, stateRecord.redirectUri);
      const oidcClaims = await verifyIdToken(config, tokenResponse.id_token);
      const tenantResolution = resolveTenantFromClaims(oidcClaims, config);
      const baseClaims: Omit<TokenClaims, "tokenUse"> = {
        tenantId: tenantResolution.tenantId,
        workspaceId: tenantResolution.workspaceId,
        subject: oidcClaims.sub,
        roles: tenantResolution.roles,
        entitlements: tenantResolution.entitlements,
      };

      const sessionRecord = sessionStore.createSession({
        tenantId: baseClaims.tenantId,
        workspaceId: baseClaims.workspaceId,
        subject: baseClaims.subject,
        roles: baseClaims.roles,
        entitlements: baseClaims.entitlements,
        idpIssuer: config.oidcIssuerUrl,
        idpSubject: oidcClaims.sub,
        createdAt: new Date(),
        expiresAt: new Date(Date.now() + refreshTtlMs),
      });

      const session = await buildSession(baseClaims, config);
      sessionStore.storeRefreshToken({
        tokenHash: hashToken(session.refreshToken),
        sessionId: sessionRecord.id,
        expiresAt: new Date(Date.now() + refreshTtlMs),
      });

      res.status(200).json(session);
    } catch (error) {
      res.status(401).json({ error: "oidc_exchange_failed" });
    }
  });

  router.post("/refresh", json(), async (req: Request, res: Response) => {
    const refreshToken = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null;
    if (!refreshToken) {
      res.status(400).json({ error: "missing_refresh_token" });
      return;
    }
    try {
      const claims = await verifyRefreshToken(refreshToken, toTokenConfig(config));
      const refreshRecord = sessionStore.consumeRefreshToken(hashToken(refreshToken));
      if (!refreshRecord) {
        res.status(401).json({ error: "refresh_token_revoked" });
        return;
      }
      const sessionRecord = sessionStore.getSession(refreshRecord.sessionId);
      if (!sessionRecord) {
        res.status(401).json({ error: "session_not_found" });
        return;
      }

      const session = await buildSession(
        {
          tenantId: claims.tenantId,
          workspaceId: claims.workspaceId,
          subject: claims.subject,
          roles: claims.roles,
          entitlements: claims.entitlements,
        },
        config,
      );
      sessionStore.storeRefreshToken({
        tokenHash: hashToken(session.refreshToken),
        sessionId: sessionRecord.id,
        expiresAt: new Date(Date.now() + refreshTtlMs),
      });
      res.status(200).json(session);
    } catch (error) {
      res.status(401).json({ error: "invalid_refresh_token" });
    }
  });

  router.post("/logout", json(), (_req: Request, res: Response) => {
    res.status(204).send();
  });

  return router;
};
