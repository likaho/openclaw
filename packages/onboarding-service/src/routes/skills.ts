import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import type { OnboardingStore } from "../store.js";

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export const createSkillsRouter = (store: OnboardingStore): Router => {
  const router = createRouter();

  router.get("/catalog", (_req: Request, res: Response) => {
    res.status(200).json({ skills: store.listSkills() });
  });

  router.post("/install", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (typeof body.userId !== "string" || typeof body.skillKey !== "string") {
      res.status(400).json({ error: "invalid_skill_install_payload" });
      return;
    }

    const install = store.installSkill(body.userId, body.skillKey);
    if (install.status === "failed") {
      res.status(400).json(install);
      return;
    }

    res.status(201).json(install);
  });

  router.post("/:skillKey/configure", json(), (req: Request, res: Response) => {
    const skillKey = firstParam(req.params.skillKey);
    const body = req.body as Record<string, unknown>;
    if (!skillKey || typeof body.userId !== "string" || typeof body.enabled !== "boolean") {
      res.status(400).json({ error: "invalid_skill_config_payload" });
      return;
    }

    const env =
      typeof body.env === "object" && body.env !== null && !Array.isArray(body.env)
        ? (body.env as Record<string, string>)
        : {};

    const config = store.configureSkill(body.userId, skillKey, body.enabled, env);
    res.status(200).json(config);
  });

  return router;
};
