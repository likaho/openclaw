import { describe, expect, it } from "vitest";
import { createInMemoryTenantStore } from "./store.js";

describe("tenant store", () => {
  it("keeps workspace isolation by tenant", () => {
    const store = createInMemoryTenantStore();
    store.createTenant({
      id: "tenant-a",
      name: "Tenant A",
      quotas: { maxWorkspaces: 10, maxMonthlyMessages: 1000 },
      featureFlags: [],
      policies: [],
    });
    store.createTenant({
      id: "tenant-b",
      name: "Tenant B",
      quotas: { maxWorkspaces: 10, maxMonthlyMessages: 1000 },
      featureFlags: [],
      policies: [],
    });
    store.createWorkspace({
      id: "workspace-1",
      name: "Workspace 1",
      tenantId: "tenant-a",
    });

    expect(store.getWorkspace("tenant-b", "workspace-1")).toBeUndefined();
  });
});
