import { describe, expect, it } from "vitest";
import { createInMemoryWorkflowStore } from "./store.js";

describe("workflow store", () => {
  it("supports idempotency lookup by tenant + dedupe key", () => {
    const store = createInMemoryWorkflowStore();
    const workflow = store.create({
      id: "wf-1",
      tenantId: "tenant-a",
      dedupeKey: "event-1",
      correlationId: "corr-1",
      status: "queued",
      maxAttempts: 3,
      attempt: 0,
    });

    const lookup = store.getByDedupeKey("tenant-a", "event-1");
    expect(lookup?.id).toBe(workflow.id);
    expect(store.getByDedupeKey("tenant-b", "event-1")).toBeUndefined();
  });
});
