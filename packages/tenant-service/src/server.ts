import express, { type Express, type Request, type Response } from "express";
import { createTenantRouter } from "./routes/tenants.js";
import type { TenantStore } from "./store.js";

export const createServer = (store: TenantStore): Express => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1", createTenantRouter(store));
  return app;
};
