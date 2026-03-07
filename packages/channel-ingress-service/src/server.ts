import express, { type Express, type Request, type Response } from "express";
import type { ChannelIngressConfig } from "./config.js";
import { createIngressRouter } from "./routes/ingress.js";
import type { IngressStore } from "./store.js";

export const createServer = (config: ChannelIngressConfig, store: IngressStore): Express => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1/ingress", createIngressRouter(config, store));

  return app;
};
