import { describe, expect, it } from "vitest";
import { executeRuntimeJob } from "./executor.js";
import type { RuntimeJob } from "./types.js";

const baseJob: RuntimeJob = {
  id: "job-1",
  tenantId: "tenant-a",
  skillId: "skill-weather",
  runtime: "node",
  capabilityProfile: "http-readonly",
  timeoutMs: 5000,
  memoryMb: 256,
  payload: "hello",
  status: "running",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("executeRuntimeJob", () => {
  it("returns succeeded result for successful payloads", async () => {
    const result = await executeRuntimeJob(baseJob);
    expect(result.status).toBe("succeeded");
    expect(result.result).toContain("node:skill-weather");
  });

  it("returns failed status for failing payloads", async () => {
    const result = await executeRuntimeJob({ ...baseJob, payload: "FAIL THIS JOB" });
    expect(result.status).toBe("failed");
    expect(result.error).toBe("runtime_execution_error");
  });
});
