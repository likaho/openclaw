import express, { type Express, type Request, type Response } from "express";
import type { SkillRuntimeConfig } from "./config.js";
import { createRuntimeRouter } from "./routes/runtime.js";
import type { RuntimeStore } from "./store.js";

export const createServer = (config: SkillRuntimeConfig, store: RuntimeStore): Express => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1/runtime", createRuntimeRouter(config, store));
  return app;
};
