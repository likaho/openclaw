import type { TenantSkillPolicy } from "./types.js";

export const evaluateAdmission = (
  input: {
    tenantId: string;
    skillId: string;
    runtime: string;
    capabilityProfile: string;
  },
  policy: TenantSkillPolicy | undefined,
): { admitted: boolean; reason: string } => {
  if (!policy || policy.tenantId !== input.tenantId) {
    return { admitted: false, reason: "tenant_policy_missing" };
  }
  if (!policy.trustedSkillIds.includes(input.skillId)) {
    return { admitted: false, reason: "skill_not_trusted" };
  }
  if (!policy.allowedRuntimes.includes(input.runtime as "node" | "python")) {
    return { admitted: false, reason: "runtime_not_allowed" };
  }
  if (!policy.allowedCapabilities.includes(input.capabilityProfile)) {
    return { admitted: false, reason: "capability_not_allowed" };
  }
  return { admitted: true, reason: "admitted" };
};
