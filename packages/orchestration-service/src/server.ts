import express, { type Express, type Request, type Response } from "express";
import { createWorkflowsRouter } from "./routes/workflows.js";
import type { WorkflowStore } from "./workflow.js";

export const createServer = (store: WorkflowStore): Express => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1/orchestration", createWorkflowsRouter(store));

  return app;
};
