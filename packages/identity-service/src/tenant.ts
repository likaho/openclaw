import type { IdentityConfig } from "./config.js";

export type TenantResolution = {
  tenantId: string;
  workspaceId: string;
  roles: string[];
  entitlements?: string[];
};

export type OidcClaims = {
  sub: string;
  email?: string;
  preferred_username?: string;
  tenant_id?: string;
  workspace_id?: string;
  roles?: string[];
  groups?: string[];
};

export const resolveTenantFromClaims = (
  claims: OidcClaims,
  config: IdentityConfig,
): TenantResolution => {
  if (claims.tenant_id) {
    return {
      tenantId: claims.tenant_id,
      workspaceId: claims.workspace_id ?? config.tenantDefaultWorkspaceId,
      roles: claims.roles ?? claims.groups ?? ["member"],
      entitlements: ["basic"],
    };
  }

  const email = claims.email ?? "";
  const domain = email.split("@")[1];

  return {
    tenantId: domain ? domain.replaceAll(".", "-") : config.tenantDefaultId,
    workspaceId: config.tenantDefaultWorkspaceId,
    roles: claims.roles ?? claims.groups ?? ["member"],
    entitlements: ["basic"],
  };
};
