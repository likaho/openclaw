export type TenantQuota = {
  maxWorkspaces: number;
  maxMonthlyMessages: number;
};

export type TenantRecord = {
  id: string;
  name: string;
  quotas: TenantQuota;
  featureFlags: string[];
  policies: string[];
  createdAt: Date;
  updatedAt: Date;
};

export type WorkspaceRecord = {
  id: string;
  tenantId: string;
  name: string;
  createdAt: Date;
};

export type TenantStore = {
  createTenant: (input: Omit<TenantRecord, "createdAt" | "updatedAt">) => TenantRecord;
  getTenant: (tenantId: string) => TenantRecord | undefined;
  updateTenant: (
    tenantId: string,
    input: Omit<TenantRecord, "id" | "createdAt" | "updatedAt">,
  ) => TenantRecord | undefined;
  createWorkspace: (input: Omit<WorkspaceRecord, "createdAt">) => WorkspaceRecord;
  getWorkspace: (tenantId: string, workspaceId: string) => WorkspaceRecord | undefined;
};

export const createInMemoryTenantStore = (): TenantStore => {
  const tenants = new Map<string, TenantRecord>();
  const workspaces = new Map<string, Map<string, WorkspaceRecord>>();

  return {
    createTenant: (input) => {
      const now = new Date();
      const record: TenantRecord = {
        ...input,
        featureFlags: [...input.featureFlags],
        policies: [...input.policies],
        createdAt: now,
        updatedAt: now,
      };
      tenants.set(record.id, record);
      if (!workspaces.has(record.id)) {
        workspaces.set(record.id, new Map());
      }
      return record;
    },
    getTenant: (tenantId) => tenants.get(tenantId),
    updateTenant: (tenantId, input) => {
      const existing = tenants.get(tenantId);
      if (!existing) {
        return undefined;
      }
      const record: TenantRecord = {
        ...existing,
        ...input,
        featureFlags: [...input.featureFlags],
        policies: [...input.policies],
        updatedAt: new Date(),
      };
      tenants.set(tenantId, record);
      return record;
    },
    createWorkspace: (input) => {
      const tenantWorkspaces = workspaces.get(input.tenantId);
      if (!tenantWorkspaces) {
        throw new Error("tenant_not_found");
      }
      const record: WorkspaceRecord = {
        ...input,
        createdAt: new Date(),
      };
      tenantWorkspaces.set(input.id, record);
      return record;
    },
    getWorkspace: (tenantId, workspaceId) => {
      const tenantWorkspaces = workspaces.get(tenantId);
      if (!tenantWorkspaces) {
        return undefined;
      }
      return tenantWorkspaces.get(workspaceId);
    },
  };
};
