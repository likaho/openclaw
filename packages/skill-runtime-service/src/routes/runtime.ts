import crypto from "node:crypto";
import type { Request, Response, Router } from "express";
import { Router as createRouter, json } from "express";
import type { SkillRuntimeConfig } from "../config.js";
import { executeRuntimeJob } from "../executor.js";
import { validateCapability, validateMemory, validateRuntime, validateTimeout } from "../guards.js";
import type { RuntimeStore } from "../store.js";

const parseLimit = (value: unknown): number => {
  if (typeof value !== "string") {
    return 20;
  }
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return 20;
  }
  return Math.min(parsed, 100);
};

export const createRuntimeRouter = (config: SkillRuntimeConfig, store: RuntimeStore): Router => {
  const router = createRouter();

  router.post("/jobs", json(), async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown>;
    if (
      typeof body.tenantId !== "string" ||
      typeof body.skillId !== "string" ||
      typeof body.runtime !== "string" ||
      typeof body.capabilityProfile !== "string" ||
      typeof body.timeoutMs !== "number" ||
      typeof body.memoryMb !== "number" ||
      typeof body.payload !== "string"
    ) {
      res.status(400).json({ error: "invalid_job_payload" });
      return;
    }

    if (!validateRuntime(body.runtime)) {
      res.status(400).json({ error: "runtime_not_supported" });
      return;
    }
    if (!validateCapability(body.capabilityProfile, config)) {
      res.status(400).json({ error: "capability_not_allowed" });
      return;
    }
    if (!validateTimeout(body.timeoutMs, config)) {
      res.status(400).json({ error: "timeout_exceeds_limit" });
      return;
    }
    if (!validateMemory(body.memoryMb, config)) {
      res.status(400).json({ error: "memory_exceeds_limit" });
      return;
    }

    let job = store.createJob({
      id: crypto.randomUUID(),
      tenantId: body.tenantId,
      skillId: body.skillId,
      runtime: body.runtime,
      capabilityProfile: body.capabilityProfile,
      timeoutMs: body.timeoutMs,
      memoryMb: body.memoryMb,
      payload: body.payload,
      status: "queued",
    });

    job = store.saveJob({ ...job, status: "running" });
    job = await executeRuntimeJob(job);
    job = store.saveJob(job);

    res.status(201).json(job);
  });

  router.get("/jobs/:jobId", (req: Request, res: Response) => {
    const jobId = typeof req.params.jobId === "string" ? req.params.jobId : undefined;
    if (!jobId) {
      res.status(400).json({ error: "invalid_job_id" });
      return;
    }
    const job = store.getJob(jobId);
    if (!job) {
      res.status(404).json({ error: "job_not_found" });
      return;
    }
    res.status(200).json(job);
  });

  router.get("/jobs", (req: Request, res: Response) => {
    const limit = parseLimit(req.query.limit);
    res.status(200).json({ jobs: store.listJobs(limit) });
  });

  router.get("/pools", (_req: Request, res: Response) => {
    res.status(200).json({ pools: store.poolStatus() });
  });

  return router;
};
