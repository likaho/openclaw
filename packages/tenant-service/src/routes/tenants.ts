import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import type { TenantStore } from "../store.js";

const parseStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
};

const getPathParam = (value: string | string[] | undefined): string | undefined =>
  typeof value === "string" ? value : undefined;

const validateTenantInput = (
  body: unknown,
):
  | {
      ok: true;
      value: {
        id: string;
        name: string;
        quotas: { maxWorkspaces: number; maxMonthlyMessages: number };
        featureFlags: string[];
        policies: string[];
      };
    }
  | { ok: false; error: string } => {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_payload" };
  }
  const record = body as Record<string, unknown>;
  const id = record.id;
  const name = record.name;
  const quotas = record.quotas;
  if (typeof id !== "string" || id.length === 0) {
    return { ok: false, error: "invalid_tenant_id" };
  }
  if (typeof name !== "string" || name.length === 0) {
    return { ok: false, error: "invalid_tenant_name" };
  }
  if (!quotas || typeof quotas !== "object") {
    return { ok: false, error: "invalid_quotas" };
  }
  const quotaRecord = quotas as Record<string, unknown>;
  const maxWorkspaces = quotaRecord.maxWorkspaces;
  const maxMonthlyMessages = quotaRecord.maxMonthlyMessages;
  if (typeof maxWorkspaces !== "number" || !Number.isInteger(maxWorkspaces) || maxWorkspaces <= 0) {
    return { ok: false, error: "invalid_max_workspaces" };
  }
  if (
    typeof maxMonthlyMessages !== "number" ||
    !Number.isInteger(maxMonthlyMessages) ||
    maxMonthlyMessages <= 0
  ) {
    return { ok: false, error: "invalid_max_monthly_messages" };
  }
  const featureFlags = parseStringArray(record.featureFlags);
  const policies = parseStringArray(record.policies);
  if (new Set(policies).size !== policies.length) {
    return { ok: false, error: "duplicate_policies" };
  }

  return {
    ok: true,
    value: {
      id,
      name,
      quotas: { maxWorkspaces, maxMonthlyMessages },
      featureFlags,
      policies,
    },
  };
};

const validateWorkspaceInput = (
  body: unknown,
): { ok: true; value: { id: string; name: string } } | { ok: false; error: string } => {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_payload" };
  }
  const record = body as Record<string, unknown>;
  if (typeof record.id !== "string" || record.id.length === 0) {
    return { ok: false, error: "invalid_workspace_id" };
  }
  if (typeof record.name !== "string" || record.name.length === 0) {
    return { ok: false, error: "invalid_workspace_name" };
  }
  return { ok: true, value: { id: record.id, name: record.name } };
};

export const createTenantRouter = (store: TenantStore): Router => {
  const router = createRouter();

  router.post("/tenants", json(), (req: Request, res: Response) => {
    const parsed = validateTenantInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const tenant = store.createTenant(parsed.value);
    res.status(201).json(tenant);
  });

  router.get("/tenants/:tenantId", (req: Request, res: Response) => {
    const tenantId = getPathParam(req.params.tenantId);
    if (!tenantId) {
      res.status(400).json({ error: "invalid_tenant_id" });
      return;
    }
    const tenant = store.getTenant(tenantId);
    if (!tenant) {
      res.status(404).json({ error: "tenant_not_found" });
      return;
    }
    res.status(200).json(tenant);
  });

  router.put("/tenants/:tenantId", json(), (req: Request, res: Response) => {
    const tenantId = getPathParam(req.params.tenantId);
    if (!tenantId) {
      res.status(400).json({ error: "invalid_tenant_id" });
      return;
    }
    const parsed = validateTenantInput({ ...req.body, id: tenantId });
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const tenant = store.updateTenant(tenantId, {
      name: parsed.value.name,
      quotas: parsed.value.quotas,
      featureFlags: parsed.value.featureFlags,
      policies: parsed.value.policies,
    });
    if (!tenant) {
      res.status(404).json({ error: "tenant_not_found" });
      return;
    }
    res.status(200).json(tenant);
  });

  router.post("/tenants/:tenantId/workspaces", json(), (req: Request, res: Response) => {
    const tenantId = getPathParam(req.params.tenantId);
    if (!tenantId) {
      res.status(400).json({ error: "invalid_tenant_id" });
      return;
    }
    const parsed = validateWorkspaceInput(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    try {
      const workspace = store.createWorkspace({
        id: parsed.value.id,
        name: parsed.value.name,
        tenantId,
      });
      res.status(201).json(workspace);
    } catch {
      res.status(404).json({ error: "tenant_not_found" });
    }
  });

  router.get("/tenants/:tenantId/workspaces/:workspaceId", (req: Request, res: Response) => {
    const tenantId = getPathParam(req.params.tenantId);
    const workspaceId = getPathParam(req.params.workspaceId);
    if (!tenantId || !workspaceId) {
      res.status(400).json({ error: "invalid_path_params" });
      return;
    }
    const workspace = store.getWorkspace(tenantId, workspaceId);
    if (!workspace) {
      res.status(404).json({ error: "workspace_not_found" });
      return;
    }
    res.status(200).json(workspace);
  });

  return router;
};
