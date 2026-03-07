import type { WorkflowRecord, WorkflowStore } from "./workflow.js";

export const createInMemoryWorkflowStore = (): WorkflowStore => {
  const byId = new Map<string, WorkflowRecord>();
  const byDedupe = new Map<string, string>();

  return {
    getById: (workflowId) => byId.get(workflowId),
    getByDedupeKey: (tenantId, dedupeKey) => {
      const id = byDedupe.get(`${tenantId}:${dedupeKey}`);
      if (!id) {
        return undefined;
      }
      return byId.get(id);
    },
    create: (workflow) => {
      const now = new Date().toISOString();
      const record: WorkflowRecord = {
        ...workflow,
        createdAt: now,
        updatedAt: now,
      };
      byId.set(record.id, record);
      byDedupe.set(`${record.tenantId}:${record.dedupeKey}`, record.id);
      return record;
    },
    save: (workflow) => {
      byId.set(workflow.id, workflow);
      byDedupe.set(`${workflow.tenantId}:${workflow.dedupeKey}`, workflow.id);
      return workflow;
    },
    list: (limit) => {
      return [...byId.values()]
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, Math.max(0, limit));
    },
  };
};
