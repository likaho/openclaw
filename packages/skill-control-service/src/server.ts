import express, { type Express, type Request, type Response } from "express";
import type { SkillControlConfig } from "./config.js";
import { createSkillsRouter } from "./routes/skills.js";
import type { SkillControlStore } from "./store.js";

export const createServer = (config: SkillControlConfig, store: SkillControlStore): Express => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1/skills", createSkillsRouter({ signatureKey: config.signatureKey, store }));
  return app;
};
