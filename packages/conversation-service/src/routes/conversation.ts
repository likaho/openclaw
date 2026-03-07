import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import type { ConversationStore } from "../store.js";
import type { ConversationServiceConfig } from "../types.js";

const parseRetentionDays = (
  value: unknown,
  config: ConversationServiceConfig,
): number | undefined => {
  if (value === undefined) {
    return config.defaultRetentionDays;
  }
  if (!Number.isInteger(value)) {
    return undefined;
  }
  const days = Number(value);
  if (days < 1 || days > config.maxRetentionDays) {
    return undefined;
  }
  return days;
};

const isRole = (value: unknown): value is "system" | "user" | "assistant" =>
  value === "system" || value === "user" || value === "assistant";

export const createConversationRouter = (
  config: ConversationServiceConfig,
  store: ConversationStore,
): Router => {
  const router = createRouter();
  const firstPathParam = (value: string | string[] | undefined): string | undefined =>
    Array.isArray(value) ? value[0] : value;

  router.post("/memory/entries", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const retentionDays = parseRetentionDays(body.retentionDays, config);
    if (
      typeof body.tenantId !== "string" ||
      typeof body.conversationId !== "string" ||
      !isRole(body.role) ||
      typeof body.content !== "string" ||
      body.content.length === 0 ||
      retentionDays === undefined
    ) {
      res.status(400).json({ error: "invalid_memory_payload" });
      return;
    }

    const entry = store.saveMemoryEntry({
      tenantId: body.tenantId,
      conversationId: body.conversationId,
      role: body.role,
      content: body.content,
      retentionDays,
    });

    store.appendAuditEvent({
      tenantId: body.tenantId,
      eventType: "conversation.memory.saved",
      actor: "conversation-service",
      payload: {
        conversationId: body.conversationId,
        memoryEntryId: entry.id,
      },
    });

    res.status(201).json(entry);
  });

  router.get("/memory/:tenantId/:conversationId", (req: Request, res: Response) => {
    const tenantId = firstPathParam(req.params.tenantId);
    const conversationId = firstPathParam(req.params.conversationId);
    if (!tenantId || !conversationId) {
      res.status(400).json({ error: "invalid_path_params" });
      return;
    }
    const entries = store.listMemoryEntries(tenantId, conversationId);
    res.status(200).json({ entries });
  });

  return router;
};
