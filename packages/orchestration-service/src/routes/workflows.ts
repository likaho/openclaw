import crypto from "node:crypto";
import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import type { WorkflowStore } from "../workflow.js";
import { transitionWorkflow } from "../workflow.js";

const parseLimit = (value: unknown): number => {
  if (typeof value !== "string") {
    return 20;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
};

const parseCreateBody = (
  body: unknown,
):
  | {
      ok: true;
      value: { tenantId: string; dedupeKey: string; correlationId: string; maxAttempts: number };
    }
  | { ok: false; error: string } => {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_payload" };
  }
  const input = body as Record<string, unknown>;
  if (typeof input.tenantId !== "string" || input.tenantId.length === 0) {
    return { ok: false, error: "invalid_tenant_id" };
  }
  if (typeof input.dedupeKey !== "string" || input.dedupeKey.length === 0) {
    return { ok: false, error: "invalid_dedupe_key" };
  }
  if (typeof input.correlationId !== "string" || input.correlationId.length === 0) {
    return { ok: false, error: "invalid_correlation_id" };
  }
  const maxAttempts = typeof input.maxAttempts === "number" ? input.maxAttempts : 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts <= 0 || maxAttempts > 10) {
    return { ok: false, error: "invalid_max_attempts" };
  }
  return {
    ok: true,
    value: {
      tenantId: input.tenantId,
      dedupeKey: input.dedupeKey,
      correlationId: input.correlationId,
      maxAttempts,
    },
  };
};

const parseTransitionBody = (
  body: unknown,
): { ok: true; value: "start" | "success" | "failure" } | { ok: false; error: string } => {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "invalid_payload" };
  }
  const input = body as Record<string, unknown>;
  if (input.event === "start" || input.event === "success" || input.event === "failure") {
    return { ok: true, value: input.event };
  }
  return { ok: false, error: "invalid_transition_event" };
};

export const createWorkflowsRouter = (store: WorkflowStore): Router => {
  const router = createRouter();

  router.post("/workflows", json(), (req: Request, res: Response) => {
    const parsed = parseCreateBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const existing = store.getByDedupeKey(parsed.value.tenantId, parsed.value.dedupeKey);
    if (existing) {
      res.status(200).json({ status: "dedupe_hit", workflow: existing });
      return;
    }

    const workflow = store.create({
      id: crypto.randomUUID(),
      tenantId: parsed.value.tenantId,
      dedupeKey: parsed.value.dedupeKey,
      correlationId: parsed.value.correlationId,
      status: "queued",
      maxAttempts: parsed.value.maxAttempts,
      attempt: 0,
    });
    res.status(201).json({ status: "created", workflow });
  });

  router.post("/workflows/:workflowId/transition", json(), (req: Request, res: Response) => {
    const workflowId =
      typeof req.params.workflowId === "string" ? req.params.workflowId : undefined;
    if (!workflowId) {
      res.status(400).json({ error: "invalid_workflow_id" });
      return;
    }
    const parsed = parseTransitionBody(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error });
      return;
    }

    const workflow = store.getById(workflowId);
    if (!workflow) {
      res.status(404).json({ error: "workflow_not_found" });
      return;
    }

    const updated = transitionWorkflow(workflow, parsed.value, new Date());
    store.save(updated);
    res.status(200).json({ workflow: updated });
  });

  router.get("/workflows", (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit);
    res.status(200).json({ workflows: store.list(limit) });
  });

  return router;
};
