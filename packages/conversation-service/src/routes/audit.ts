import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import type { ConversationStore } from "../store.js";

const parseLimit = (value: unknown): number => {
  if (typeof value !== "string") {
    return 100;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 100;
  }
  return Math.min(parsed, 500);
};

export const createAuditRouter = (store: ConversationStore): Router => {
  const router = createRouter();
  const firstPathParam = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  router.post("/events", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (
      typeof body.tenantId !== "string" ||
      typeof body.eventType !== "string" ||
      typeof body.actor !== "string" ||
      typeof body.payload !== "object" ||
      body.payload === null ||
      Array.isArray(body.payload)
    ) {
      res.status(400).json({ error: "invalid_audit_payload" });
      return;
    }

    const event = store.appendAuditEvent({
      tenantId: body.tenantId,
      eventType: body.eventType,
      actor: body.actor,
      payload: body.payload as Record<string, unknown>,
    });

    res.status(201).json(event);
  });

  router.get("/events/:tenantId", (req: Request, res: Response) => {
    const tenantId = firstPathParam(req.params.tenantId);
    if (!tenantId) {
      res.status(400).json({ error: "invalid_path_params" });
      return;
    }
    const limit = parseLimit(req.query.limit);
    res.status(200).json({ events: store.listAuditEvents(tenantId, limit) });
  });

  router.get("/verify/:tenantId", (req: Request, res: Response) => {
    const tenantId = firstPathParam(req.params.tenantId);
    if (!tenantId) {
      res.status(400).json({ error: "invalid_path_params" });
      return;
    }
    const verification = store.verifyAuditIntegrity(tenantId);
    if (!verification.valid) {
      res.status(409).json(verification);
      return;
    }
    res.status(200).json(verification);
  });

  return router;
};
