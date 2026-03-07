import express, { type Express, type Request, type Response } from "express";
import { createAuditRouter } from "./routes/audit.js";
import { createConversationRouter } from "./routes/conversation.js";
import { createProviderRouter } from "./routes/provider.js";
import type { ConversationStore } from "./store.js";
import type { ConversationServiceConfig } from "./types.js";

export const createServer = (
  config: ConversationServiceConfig,
  store: ConversationStore,
): Express => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1/conversations", createConversationRouter(config, store));
  app.use("/v1/providers", createProviderRouter(config, store));
  app.use("/v1/audit", createAuditRouter(store));

  return app;
};
