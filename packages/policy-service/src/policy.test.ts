import { describe, expect, it } from "vitest";
import { evaluateDecision, type TenantPolicy } from "./policy.js";

const tenantPolicy: TenantPolicy = {
  tenantId: "tenant-a",
  rolePermissions: {
    admin: ["*"],
    member: ["message:send", "workspace:read"],
    auditor: ["audit:read"],
  },
  actionEntitlements: {
    "skills:execute": "skill:execute",
    "audit:read": "audit:read",
  },
};

describe("evaluateDecision", () => {
  it("allows wildcard admin role inside tenant", () => {
    const decision = evaluateDecision(
      {
        tenantId: "tenant-a",
        subject: { tenantId: "tenant-a", roles: ["admin"] },
        resource: { tenantId: "tenant-a", type: "workspace" },
        action: "channels:configure",
      },
      tenantPolicy,
    );
    expect(decision).toEqual({ allow: true, reason: "allow" });
  });

  it("denies by default when role lacks action permission", () => {
    const decision = evaluateDecision(
      {
        tenantId: "tenant-a",
        subject: { tenantId: "tenant-a", roles: ["member"] },
        resource: { tenantId: "tenant-a", type: "workspace" },
        action: "channels:configure",
      },
      tenantPolicy,
    );
    expect(decision).toEqual({ allow: false, reason: "role_not_allowed" });
  });

  it("denies cross-tenant access attempts", () => {
    const decision = evaluateDecision(
      {
        tenantId: "tenant-a",
        subject: { tenantId: "tenant-a", roles: ["admin"] },
        resource: { tenantId: "tenant-b", type: "workspace" },
        action: "workspace:read",
      },
      tenantPolicy,
    );
    expect(decision).toEqual({ allow: false, reason: "cross_tenant_denied" });
  });

  it("denies when required entitlement is missing", () => {
    const decision = evaluateDecision(
      {
        tenantId: "tenant-a",
        subject: { tenantId: "tenant-a", roles: ["auditor"], entitlements: [] },
        resource: { tenantId: "tenant-a", type: "audit" },
        action: "audit:read",
      },
      tenantPolicy,
    );
    expect(decision).toEqual({ allow: false, reason: "entitlement_required" });
  });
});
