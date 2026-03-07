export type WorkflowStatus = "queued" | "running" | "retrying" | "succeeded" | "failed";

export type WorkflowRecord = {
  id: string;
  tenantId: string;
  dedupeKey: string;
  correlationId: string;
  status: WorkflowStatus;
  maxAttempts: number;
  attempt: number;
  nextRetryAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkflowStore = {
  getById: (workflowId: string) => WorkflowRecord | undefined;
  getByDedupeKey: (tenantId: string, dedupeKey: string) => WorkflowRecord | undefined;
  create: (workflow: Omit<WorkflowRecord, "createdAt" | "updatedAt">) => WorkflowRecord;
  save: (workflow: WorkflowRecord) => WorkflowRecord;
  list: (limit: number) => WorkflowRecord[];
};

export const computeRetryDelayMs = (attempt: number): number => {
  const safeAttempt = Math.max(1, attempt);
  const capped = Math.min(safeAttempt, 6);
  return 1000 * 2 ** (capped - 1);
};

export const transitionWorkflow = (
  current: WorkflowRecord,
  event: "start" | "success" | "failure",
  now: Date,
): WorkflowRecord => {
  if (event === "start") {
    if (current.status !== "queued" && current.status !== "retrying") {
      return current;
    }
    return {
      ...current,
      status: "running",
      attempt: current.attempt + 1,
      nextRetryAt: undefined,
      error: undefined,
      updatedAt: now.toISOString(),
    };
  }

  if (event === "success") {
    if (current.status !== "running") {
      return current;
    }
    return {
      ...current,
      status: "succeeded",
      nextRetryAt: undefined,
      error: undefined,
      updatedAt: now.toISOString(),
    };
  }

  if (current.status !== "running") {
    return current;
  }

  if (current.attempt >= current.maxAttempts) {
    return {
      ...current,
      status: "failed",
      error: "max_attempts_exhausted",
      nextRetryAt: undefined,
      updatedAt: now.toISOString(),
    };
  }

  const delay = computeRetryDelayMs(current.attempt);
  return {
    ...current,
    status: "retrying",
    error: "retry_scheduled",
    nextRetryAt: new Date(now.getTime() + delay).toISOString(),
    updatedAt: now.toISOString(),
  };
};
