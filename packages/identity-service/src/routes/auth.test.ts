import type { Request, Response } from "express";
import { describe, expect, it } from "vitest";
import type { IdentityConfig } from "../config.js";
import type { SessionStore } from "../store.js";
import { createInMemorySessionStore } from "../store.js";
import { issueRefreshToken } from "../tokens.js";
import { createAuthHandlers } from "./auth.js";

const testConfig: IdentityConfig = {
  port: 0,
  oidcIssuerUrl: "https://issuer.example",
  oidcClientId: "client-id",
  oidcClientSecret: "client-secret",
  oidcRedirectUri: "https://app.example/callback",
  jwtIssuer: "openclaw-identity",
  jwtAudience: "openclaw-api",
  jwtSecret: "test-secret",
  tenantDefaultId: "default",
  tenantDefaultWorkspaceId: "default",
};

const tokenConfig = {
  issuer: testConfig.jwtIssuer,
  audience: testConfig.jwtAudience,
  secret: testConfig.jwtSecret,
};

type MockResponse = {
  statusCode: number;
  body: unknown;
  status: (code: number) => MockResponse;
  json: (payload: unknown) => MockResponse;
  send: (payload?: unknown) => MockResponse;
};

const createMockResponse = (): MockResponse => {
  const response: MockResponse = {
    statusCode: 200,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
    send(payload?: unknown) {
      this.body = payload;
      return this;
    },
  };
  return response;
};

const createMockRequest = (value: {
  body?: unknown;
  query?: Record<string, string | undefined>;
}): Request => {
  return {
    body: value.body ?? {},
    query: value.query ?? {},
  } as Request;
};

describe("auth handlers", () => {
  it("rejects callback when state is invalid", async () => {
    const handlers = createAuthHandlers(testConfig);
    const response = createMockResponse();

    await handlers.callback(
      createMockRequest({ query: { code: "test", state: "missing" } }),
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(400);
    expect(response.body).toEqual({ error: "invalid_state" });
  });

  it("rotates refresh tokens and revokes token on logout", async () => {
    const handlers = createAuthHandlers(testConfig, {
      exchangeCodeForTokensFn: async () => ({
        access_token: "idp-access",
        id_token: "id-token",
        expires_in: 300,
      }),
      verifyIdTokenFn: async () => ({
        sub: "user-123",
        tenant_id: "tenant-a",
        workspace_id: "workspace-a",
        roles: ["member"],
      }),
    });

    const loginResponse = createMockResponse();
    handlers.login(
      createMockRequest({
        body: {
          redirectUri: testConfig.oidcRedirectUri,
          tenantHint: "tenant-a",
        },
      }),
      loginResponse as unknown as Response,
    );
    expect(loginResponse.statusCode).toBe(200);

    const redirectUrl = (loginResponse.body as { redirectUrl: string }).redirectUrl;
    const state = new URL(redirectUrl).searchParams.get("state");
    expect(state).toBeTruthy();

    const callbackResponse = createMockResponse();
    await handlers.callback(
      createMockRequest({ query: { code: "auth-code", state: state ?? undefined } }),
      callbackResponse as unknown as Response,
    );
    expect(callbackResponse.statusCode).toBe(200);

    const session = callbackResponse.body as { refreshToken: string };
    const refreshResponse = createMockResponse();
    await handlers.refresh(
      createMockRequest({ body: { refreshToken: session.refreshToken } }),
      refreshResponse as unknown as Response,
    );
    expect(refreshResponse.statusCode).toBe(200);
    const refreshed = refreshResponse.body as { refreshToken: string };

    const staleRefresh = createMockResponse();
    await handlers.refresh(
      createMockRequest({ body: { refreshToken: session.refreshToken } }),
      staleRefresh as unknown as Response,
    );
    expect(staleRefresh.statusCode).toBe(401);
    expect(staleRefresh.body).toEqual({ error: "refresh_token_revoked" });

    const logoutResponse = createMockResponse();
    await handlers.logout(
      createMockRequest({ body: { refreshToken: refreshed.refreshToken } }),
      logoutResponse as unknown as Response,
    );
    expect(logoutResponse.statusCode).toBe(204);
  });

  it("returns session_not_found when refresh token points to missing session", async () => {
    const store: SessionStore = {
      createSession: async (session) => ({ id: "ignored", ...session }),
      getSession: async () => undefined,
      storeRefreshToken: async () => undefined,
      consumeRefreshToken: async () => ({
        tokenHash: "hash",
        sessionId: "missing-session",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    };

    const handlers = createAuthHandlers(testConfig, { sessionStore: store });
    const refreshToken = await issueRefreshToken(
      {
        tenantId: "tenant-a",
        workspaceId: "default",
        subject: "user-1",
        roles: ["member"],
      },
      tokenConfig,
      "1d",
    );

    const response = createMockResponse();
    await handlers.refresh(
      createMockRequest({ body: { refreshToken } }),
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "session_not_found" });
  });

  it("rejects invalid logout tokens", async () => {
    const handlers = createAuthHandlers(testConfig, { sessionStore: createInMemorySessionStore() });
    const response = createMockResponse();

    await handlers.logout(
      createMockRequest({ body: { refreshToken: "not-issued" } }),
      response as unknown as Response,
    );

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "invalid_refresh_token" });
  });
});
