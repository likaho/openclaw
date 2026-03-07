import { describe, expect, it } from "vitest";
import type { IdentityConfig } from "./config.js";
import { resolveTenantFromClaims } from "./tenant.js";

const config: IdentityConfig = {
  port: 0,
  oidcIssuerUrl: "",
  oidcClientId: "",
  oidcClientSecret: "",
  oidcRedirectUri: "",
  jwtIssuer: "",
  jwtAudience: "",
  jwtSecret: "",
  tenantDefaultId: "default",
  tenantDefaultWorkspaceId: "default",
};

describe("resolveTenantFromClaims", () => {
  it("uses explicit tenant id when present", () => {
    const result = resolveTenantFromClaims(
      {
        sub: "user-1",
        tenant_id: "tenant-explicit",
        workspace_id: "workspace-a",
        roles: ["admin"],
      },
      config,
    );

    expect(result.tenantId).toBe("tenant-explicit");
    expect(result.workspaceId).toBe("workspace-a");
    expect(result.roles).toEqual(["admin"]);
  });

  it("derives tenant id from email domain", () => {
    const result = resolveTenantFromClaims(
      {
        sub: "user-2",
        email: "alex@example.com",
      },
      config,
    );

    expect(result.tenantId).toBe("example-com");
    expect(result.workspaceId).toBe("default");
  });
});
