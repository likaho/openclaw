import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import { evaluateDecision, type DecisionRequest, type TenantPolicy } from "../policy.js";
import type { PolicyStore } from "../store.js";

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === "string");

const parseTenantPolicy = (
  body: unknown,
): { ok: true; value: TenantPolicy } | { ok: false; error: string } => {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_payload" };
  }
  const input = body as Record<string, unknown>;
  if (typeof input.tenantId !== "string" || input.tenantId.length === 0) {
    return { ok: false, error: "invalid_tenant_id" };
  }
  if (!input.rolePermissions || typeof input.rolePermissions !== "object") {
    return { ok: false, error: "invalid_role_permissions" };
  }
  if (!input.actionEntitlements || typeof input.actionEntitlements !== "object") {
    return { ok: false, error: "invalid_action_entitlements" };
  }

  const rolePermissions = Object.fromEntries(
    Object.entries(input.rolePermissions as Record<string, unknown>).map(([role, actions]) => [
      role,
      isStringArray(actions) ? actions : [],
    ]),
  );

  const actionEntitlements = Object.fromEntries(
    Object.entries(input.actionEntitlements as Record<string, unknown>).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string",
    ),
  );

  return {
    ok: true,
    value: {
      tenantId: input.tenantId,
      rolePermissions,
      actionEntitlements,
    },
  };
};

const parseDecisionRequest = (
  body: unknown,
): { ok: true; value: DecisionRequest } | { ok: false; error: string } => {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_payload" };
  }
  const input = body as Record<string, unknown>;
  const subject = input.subject as Record<string, unknown> | undefined;
  const resource = input.resource as Record<string, unknown> | undefined;
  if (typeof input.tenantId !== "string") {
    return { ok: false, error: "invalid_tenant_id" };
  }
  if (!subject || typeof subject.tenantId !== "string" || !isStringArray(subject.roles)) {
    return { ok: false, error: "invalid_subject" };
  }
  if (!resource || typeof resource.tenantId !== "string" || typeof resource.type !== "string") {
    return { ok: false, error: "invalid_resource" };
  }
  if (typeof input.action !== "string") {
    return { ok: false, error: "invalid_action" };
  }

  return {
    ok: true,
    value: {
      tenantId: input.tenantId,
      subject: {
        tenantId: subject.tenantId,
        roles: subject.roles,
        entitlements: isStringArray(subject.entitlements) ? subject.entitlements : undefined,
      },
      resource: {
        tenantId: resource.tenantId,
        type: resource.type,
      },
      action: input.action,
    },
  };
};

export const createPolicyRouter = (store: PolicyStore): Router => {
  const router = createRouter();

  router.post("/tenants", json(), (req: Request, res: Response) => {
    const parsed = parseTenantPolicy(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }
    const policy = store.setTenantPolicy(parsed.value);
    res.status(201).json(policy);
  });

  router.get("/tenants/:tenantId", (req: Request, res: Response) => {
    const tenantId = typeof req.params.tenantId === "string" ? req.params.tenantId : undefined;
    if (!tenantId) {
      res.status(400).json({ error: "invalid_tenant_id" });
      return;
    }
    const policy = store.getTenantPolicy(tenantId);
    if (!policy) {
      res.status(404).json({ error: "tenant_policy_not_found" });
      return;
    }
    res.status(200).json(policy);
  });

  router.post("/decide", json(), (req: Request, res: Response) => {
    const parsed = parseDecisionRequest(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const policy = store.getTenantPolicy(parsed.value.tenantId);
    const decision = evaluateDecision(parsed.value, policy);
    res.status(200).json(decision);
  });

  return router;
};
