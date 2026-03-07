import { describe, expect, it } from "vitest";
import { createInMemoryRuntimeStore } from "./store.js";

describe("runtime store", () => {
  it("tracks pool status for running and completed jobs", () => {
    const store = createInMemoryRuntimeStore();
    const job = store.createJob({
      id: "job-1",
      tenantId: "tenant-a",
      skillId: "skill-weather",
      runtime: "node",
      capabilityProfile: "http-readonly",
      timeoutMs: 5000,
      memoryMb: 256,
      payload: "ok",
      status: "queued",
    });
    store.saveJob({ ...job, status: "running" });
    store.saveJob({ ...job, status: "succeeded" });

    const nodePool = store.poolStatus().find((pool) => pool.runtime === "node");
    expect(nodePool?.activeJobs).toBe(0);
    expect(nodePool?.completedJobs).toBe(1);
  });
});
