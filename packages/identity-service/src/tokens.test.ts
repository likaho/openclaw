import { describe, expect, it } from "vitest";
import { issueAccessToken, issueRefreshToken, verifyAccessToken, verifyRefreshToken } from "./tokens.js";

const tokenConfig = {
  issuer: "openclaw-identity",
  audience: "openclaw-api",
  secret: "super-secret-value",
};

const claims = {
  tenantId: "tenant-a",
  workspaceId: "default",
  subject: "user-123",
  roles: ["member"],
  entitlements: ["basic"],
};

describe("tokens", () => {
  it("issues and verifies access tokens", async () => {
    const token = await issueAccessToken(claims, tokenConfig, "5m");
    const verified = await verifyAccessToken(token, tokenConfig);

    expect(verified.tenantId).toBe(claims.tenantId);
    expect(verified.workspaceId).toBe(claims.workspaceId);
    expect(verified.subject).toBe(claims.subject);
    expect(verified.roles).toEqual(claims.roles);
    expect(verified.tokenUse).toBe("access");
  });

  it("rejects access tokens when audience mismatches", async () => {
    const token = await issueAccessToken(claims, tokenConfig, "5m");
    await expect(
      verifyAccessToken(token, {
        ...tokenConfig,
        audience: "wrong-audience",
      }),
    ).rejects.toThrow();
  });

  it("issues and verifies refresh tokens", async () => {
    const token = await issueRefreshToken(claims, tokenConfig, "1d");
    const verified = await verifyRefreshToken(token, tokenConfig);

    expect(verified.tenantId).toBe(claims.tenantId);
    expect(verified.subject).toBe(claims.subject);
    expect(verified.tokenUse).toBe("refresh");
  });
});
