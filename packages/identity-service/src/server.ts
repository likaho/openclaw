import express, { type Express, type Request, type Response } from "express";
import type { IdentityConfig } from "./config.js";
import type { AuthRouterDeps } from "./routes/auth.js";
import { createAuthRouter } from "./routes/auth.js";

export const createServer = (config: IdentityConfig, deps: AuthRouterDeps = {}): Express => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1/auth", createAuthRouter(config, deps));

  return app;
};
