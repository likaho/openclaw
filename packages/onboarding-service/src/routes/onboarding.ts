import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import type { OnboardingStore } from "../store.js";
import type { OnboardingServiceConfig } from "../types.js";

const firstParam = (value: string | string[] | undefined): string | undefined =>
  Array.isArray(value) ? value[0] : value;

export const createOnboardingRouter = (
  config: OnboardingServiceConfig,
  store: OnboardingStore,
): Router => {
  const router = createRouter();

  router.post("/signup", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (typeof body.email !== "string" || typeof body.displayName !== "string") {
      res.status(400).json({ error: "invalid_signup_payload" });
      return;
    }
    const user = store.createUser(body.email, body.displayName, "self-serve");
    res.status(201).json(user);
  });

  router.post("/invite/accept", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (
      typeof body.token !== "string" ||
      typeof body.displayName !== "string" ||
      typeof body.email !== "string"
    ) {
      res.status(400).json({ error: "invalid_invite_payload" });
      return;
    }

    const invite = store.acceptInvite(body.token);
    if (!invite) {
      res.status(404).json({ error: "invite_not_found_or_used" });
      return;
    }

    const user = store.createUser(body.email, body.displayName, "invite");
    res.status(201).json({ user, invite });
  });

  router.post("/bootstrap", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (
      typeof body.tenantId !== "string" ||
      typeof body.ownerUserId !== "string" ||
      (body.profile !== "starter" && body.profile !== "regulated")
    ) {
      res.status(400).json({ error: "invalid_bootstrap_payload" });
      return;
    }

    const workspaceId =
      typeof body.workspaceId === "string" && body.workspaceId.length > 0
        ? body.workspaceId
        : config.defaultWorkspace;

    const bootstrap = store.createTenantBootstrap(
      body.tenantId,
      workspaceId,
      body.ownerUserId,
      body.profile,
    );

    res.status(201).json(bootstrap);
  });

  router.get("/wizard-state/:userId", (req: Request, res: Response) => {
    const userId = firstParam(req.params.userId);
    if (!userId) {
      res.status(400).json({ error: "invalid_path_params" });
      return;
    }

    const state = store.getWizardState(userId);
    if (!state) {
      res.status(404).json({ error: "wizard_state_not_found" });
      return;
    }

    res.status(200).json(state);
  });

  router.post("/wizard-state", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (
      typeof body.userId !== "string" ||
      (body.stage !== "account" &&
        body.stage !== "channels" &&
        body.stage !== "skills" &&
        body.stage !== "complete") ||
      !Array.isArray(body.completedSteps) ||
      !body.completedSteps.every((entry) => typeof entry === "string")
    ) {
      res.status(400).json({ error: "invalid_wizard_payload" });
      return;
    }

    const state = store.setWizardState({
      userId: body.userId,
      stage: body.stage,
      completedSteps: body.completedSteps,
      updatedAt: new Date().toISOString(),
    });

    res.status(200).json(state);
  });

  router.post("/setup/complete", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (
      typeof body.userId !== "string" ||
      typeof body.tenantId !== "string" ||
      typeof body.workspaceId !== "string"
    ) {
      res.status(400).json({ error: "invalid_setup_complete_payload" });
      return;
    }

    const completion = store.completeSetup(body.userId, body.tenantId, body.workspaceId);
    res.status(201).json(completion);
  });

  return router;
};
