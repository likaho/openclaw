import { describe, expect, it } from "vitest";
import { computeRetryDelayMs, transitionWorkflow, type WorkflowRecord } from "./workflow.js";

const baseWorkflow: WorkflowRecord = {
  id: "wf-1",
  tenantId: "tenant-a",
  dedupeKey: "d1",
  correlationId: "corr-1",
  status: "queued",
  maxAttempts: 3,
  attempt: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

describe("workflow transitions", () => {
  it("transitions queued -> running -> succeeded", () => {
    const now = new Date("2026-01-01T00:00:01.000Z");
    const running = transitionWorkflow(baseWorkflow, "start", now);
    expect(running.status).toBe("running");
    expect(running.attempt).toBe(1);

    const succeeded = transitionWorkflow(running, "success", now);
    expect(succeeded.status).toBe("succeeded");
  });

  it("schedules retry with exponential backoff on failure before max attempts", () => {
    const now = new Date("2026-01-01T00:00:01.000Z");
    const running = transitionWorkflow(baseWorkflow, "start", now);
    const retrying = transitionWorkflow(running, "failure", now);
    expect(retrying.status).toBe("retrying");
    expect(retrying.nextRetryAt).toBeDefined();
    expect(retrying.error).toBe("retry_scheduled");
  });

  it("marks workflow failed when max attempts are exhausted", () => {
    const running: WorkflowRecord = {
      ...baseWorkflow,
      status: "running",
      attempt: 3,
      maxAttempts: 3,
    };
    const failed = transitionWorkflow(running, "failure", new Date("2026-01-01T00:00:03.000Z"));
    expect(failed.status).toBe("failed");
    expect(failed.error).toBe("max_attempts_exhausted");
  });
});

describe("retry backoff", () => {
  it("caps exponential delay growth", () => {
    expect(computeRetryDelayMs(1)).toBe(1000);
    expect(computeRetryDelayMs(2)).toBe(2000);
    expect(computeRetryDelayMs(6)).toBe(32000);
    expect(computeRetryDelayMs(10)).toBe(32000);
  });
});
