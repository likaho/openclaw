import express, { type Express, type Request, type Response } from "express";
import { createPolicyRouter } from "./routes/policy.js";
import type { PolicyStore } from "./store.js";

export const createServer = (store: PolicyStore): Express => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1/policy", createPolicyRouter(store));
  return app;
};
