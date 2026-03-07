export type DecisionRequest = {
  tenantId: string;
  subject: {
    tenantId: string;
    roles: string[];
    entitlements?: string[];
  };
  resource: {
    tenantId: string;
    type: string;
  };
  action: string;
};

export type DecisionResponse = {
  allow: boolean;
  reason:
    | "allow"
    | "cross_tenant_denied"
    | "tenant_policy_missing"
    | "entitlement_required"
    | "role_not_allowed";
};

export type TenantPolicy = {
  tenantId: string;
  rolePermissions: Record<string, string[]>;
  actionEntitlements: Record<string, string>;
};

export const evaluateDecision = (
  request: DecisionRequest,
  policy: TenantPolicy | undefined,
): DecisionResponse => {
  if (request.subject.tenantId !== request.resource.tenantId) {
    return { allow: false, reason: "cross_tenant_denied" };
  }

  if (!policy || policy.tenantId !== request.tenantId) {
    return { allow: false, reason: "tenant_policy_missing" };
  }

  const requiredEntitlement = policy.actionEntitlements[request.action];
  if (requiredEntitlement) {
    const entitlements = request.subject.entitlements ?? [];
    if (!entitlements.includes(requiredEntitlement)) {
      return { allow: false, reason: "entitlement_required" };
    }
  }

  const hasRolePermission = request.subject.roles.some((role) => {
    const actions = policy.rolePermissions[role] ?? [];
    return actions.includes("*") || actions.includes(request.action);
  });

  if (!hasRolePermission) {
    return { allow: false, reason: "role_not_allowed" };
  }

  return { allow: true, reason: "allow" };
};
