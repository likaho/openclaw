export type RuntimeKind = "node" | "python";
export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "rejected";

export type RuntimeJob = {
  id: string;
  tenantId: string;
  skillId: string;
  runtime: RuntimeKind;
  capabilityProfile: string;
  timeoutMs: number;
  memoryMb: number;
  payload: string;
  status: JobStatus;
  result?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
};

export type RuntimePoolStatus = {
  runtime: RuntimeKind;
  activeJobs: number;
  completedJobs: number;
  failedJobs: number;
};
