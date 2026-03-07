import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import { evaluateAdmission } from "../admission.js";
import { verifySignature } from "../signature.js";
import type { SkillControlStore } from "../store.js";
import type { RolloutStage, SkillRuntime } from "../types.js";

type SkillsRouterDeps = {
  signatureKey: string;
  store: SkillControlStore;
};

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === "string");

const parseRuntime = (value: unknown): SkillRuntime | undefined =>
  value === "node" || value === "python" ? value : undefined;

const parseStage = (value: unknown): RolloutStage | undefined =>
  value === "dev" || value === "canary" || value === "general" ? value : undefined;

export const createSkillsRouter = ({ signatureKey, store }: SkillsRouterDeps): Router => {
  const router = createRouter();

  router.post("/policies", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (
      typeof body.tenantId !== "string" ||
      !isStringArray(body.allowedRuntimes) ||
      !isStringArray(body.allowedCapabilities) ||
      !isStringArray(body.trustedSkillIds)
    ) {
      res.status(400).json({ error: "invalid_policy_payload" });
      return;
    }
    const parsedRuntimes = body.allowedRuntimes
      .map((runtime) => parseRuntime(runtime))
      .filter((runtime): runtime is SkillRuntime => Boolean(runtime));
    if (parsedRuntimes.length !== body.allowedRuntimes.length) {
      res.status(400).json({ error: "invalid_runtime_value" });
      return;
    }
    const policy = store.setTenantPolicy({
      tenantId: body.tenantId,
      allowedRuntimes: parsedRuntimes,
      allowedCapabilities: body.allowedCapabilities,
      trustedSkillIds: body.trustedSkillIds,
    });
    res.status(201).json(policy);
  });

  router.post("/artifacts", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const runtime = parseRuntime(body.runtime);
    if (
      typeof body.tenantId !== "string" ||
      typeof body.skillId !== "string" ||
      typeof body.version !== "string" ||
      !runtime ||
      typeof body.capabilityProfile !== "string" ||
      typeof body.artifactDigest !== "string" ||
      typeof body.signature !== "string"
    ) {
      res.status(400).json({ error: "invalid_artifact_payload" });
      return;
    }

    const validSignature = verifySignature(
      {
        tenantId: body.tenantId,
        skillId: body.skillId,
        version: body.version,
        runtime,
        capabilityProfile: body.capabilityProfile,
        artifactDigest: body.artifactDigest,
        sbomDigest: typeof body.sbomDigest === "string" ? body.sbomDigest : undefined,
        signature: body.signature,
      },
      signatureKey,
    );
    if (!validSignature) {
      res.status(400).json({ error: "invalid_signature" });
      return;
    }

    const admission = evaluateAdmission(
      {
        tenantId: body.tenantId,
        skillId: body.skillId,
        runtime,
        capabilityProfile: body.capabilityProfile,
      },
      store.getTenantPolicy(body.tenantId),
    );

    const artifact = store.saveArtifact({
      tenantId: body.tenantId,
      skillId: body.skillId,
      version: body.version,
      runtime,
      capabilityProfile: body.capabilityProfile,
      artifactDigest: body.artifactDigest,
      sbomDigest: typeof body.sbomDigest === "string" ? body.sbomDigest : undefined,
      signature: body.signature,
      admitted: admission.admitted,
      admittedReason: admission.reason,
      createdAt: new Date().toISOString(),
    });

    res.status(201).json(artifact);
  });

  router.post("/rollouts", json(), (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    const stage = parseStage(body.stage);
    if (
      typeof body.tenantId !== "string" ||
      typeof body.skillId !== "string" ||
      typeof body.version !== "string" ||
      !stage
    ) {
      res.status(400).json({ error: "invalid_rollout_payload" });
      return;
    }
    const artifact = store.getArtifact(body.tenantId, body.skillId, body.version);
    if (!artifact) {
      res.status(404).json({ error: "artifact_not_found" });
      return;
    }
    if (!artifact.admitted) {
      res.status(400).json({ error: "artifact_not_admitted" });
      return;
    }

    const canaryPercent = typeof body.canaryPercent === "number" ? body.canaryPercent : undefined;
    if (stage === "canary") {
      if (
        canaryPercent === undefined ||
        !Number.isInteger(canaryPercent) ||
        canaryPercent < 1 ||
        canaryPercent > 50
      ) {
        res.status(400).json({ error: "invalid_canary_percent" });
        return;
      }
    } else if (canaryPercent !== undefined) {
      res.status(400).json({ error: "canary_percent_not_allowed" });
      return;
    }

    const rollout = store.saveRollout({
      tenantId: body.tenantId,
      skillId: body.skillId,
      version: body.version,
      stage,
      canaryPercent,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json(rollout);
  });

  router.get("/rollouts/:tenantId/:skillId", (req: Request, res: Response) => {
    const tenantId = typeof req.params.tenantId === "string" ? req.params.tenantId : undefined;
    const skillId = typeof req.params.skillId === "string" ? req.params.skillId : undefined;
    if (!tenantId || !skillId) {
      res.status(400).json({ error: "invalid_path_params" });
      return;
    }
    res.status(200).json({ rollouts: store.listRollouts(tenantId, skillId) });
  });

  return router;
};
