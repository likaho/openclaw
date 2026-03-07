import { describe, expect, it } from "vitest";
import { evaluateAdmission } from "./admission.js";

describe("admission policy", () => {
  it("allows trusted skill with allowed runtime and capability", () => {
    const decision = evaluateAdmission(
      {
        tenantId: "tenant-a",
        skillId: "skill-x",
        runtime: "node",
        capabilityProfile: "http-readonly",
      },
      {
        tenantId: "tenant-a",
        allowedRuntimes: ["node"],
        allowedCapabilities: ["http-readonly"],
        trustedSkillIds: ["skill-x"],
      },
    );
    expect(decision).toEqual({ admitted: true, reason: "admitted" });
  });

  it("denies when capability is not allowed", () => {
    const decision = evaluateAdmission(
      {
        tenantId: "tenant-a",
        skillId: "skill-x",
        runtime: "node",
        capabilityProfile: "tenant-storage",
      },
      {
        tenantId: "tenant-a",
        allowedRuntimes: ["node"],
        allowedCapabilities: ["http-readonly"],
        trustedSkillIds: ["skill-x"],
      },
    );
    expect(decision).toEqual({ admitted: false, reason: "capability_not_allowed" });
  });
});
