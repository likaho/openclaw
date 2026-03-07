import express, { type Express, type Request, type Response } from "express";
import { createChannelsRouter } from "./routes/channels.js";
import { createOnboardingRouter } from "./routes/onboarding.js";
import { createSkillsRouter } from "./routes/skills.js";
import type { OnboardingStore } from "./store.js";
import type { OnboardingServiceConfig } from "./types.js";

export const createServer = (config: OnboardingServiceConfig, store: OnboardingStore): Express => {
  const app = express();

  app.get("/healthz", (_req: Request, res: Response) => {
    res.status(200).json({ status: "ok" });
  });

  app.use("/v1/onboarding", createOnboardingRouter(config, store));
  app.use("/v1/channels", createChannelsRouter(store));
  app.use("/v1/skills", createSkillsRouter(store));

  return app;
};
