import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import { proxyProviderRequest } from "../proxy.js";
import type { ConversationStore } from "../store.js";
import type { ConversationServiceConfig } from "../types.js";

export const createProviderRouter = (
  config: ConversationServiceConfig,
  store: ConversationStore,
): Router => {
  const router = createRouter();

  router.post("/proxy", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (typeof body.tenantId !== "string" || typeof body.provider !== "string") {
      res.status(400).json({ error: "invalid_provider_payload" });
      return;
    }
    const result = proxyProviderRequest(config, store, {
      tenantId: body.tenantId,
      provider: body.provider,
      model: typeof body.model === "string" ? body.model : undefined,
      prompt: typeof body.prompt === "string" ? body.prompt : undefined,
      correlationId: typeof body.correlationId === "string" ? body.correlationId : undefined,
    });
    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.status(200).json(result.response);
  });

  return router;
};
