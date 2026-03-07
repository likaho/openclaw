import express, { type Request, type Response } from "express";
import type { IdentityConfig } from "./config.js";
import { createAuthRouter } from "./routes/auth.js";

export const createServer = (config: IdentityConfig) => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1/auth", createAuthRouter(config));

  return app;
};
