import type { TenantPolicy } from "./policy.js";

export type PolicyStore = {
  setTenantPolicy: (policy: TenantPolicy) => TenantPolicy;
  getTenantPolicy: (tenantId: string) => TenantPolicy | undefined;
};

export const createInMemoryPolicyStore = (): PolicyStore => {
  const policies = new Map<string, TenantPolicy>();

  return {
    setTenantPolicy: (policy) => {
      const copy: TenantPolicy = {
        tenantId: policy.tenantId,
        rolePermissions: Object.fromEntries(
          Object.entries(policy.rolePermissions).map(([role, actions]) => [role, [...actions]]),
        ),
        actionEntitlements: { ...policy.actionEntitlements },
      };
      policies.set(copy.tenantId, copy);
      return copy;
    },
    getTenantPolicy: (tenantId) => policies.get(tenantId),
  };
};
