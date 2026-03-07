import type { RuntimeJob, RuntimeKind, RuntimePoolStatus } from "./types.js";

export type RuntimeStore = {
  createJob: (job: Omit<RuntimeJob, "createdAt" | "updatedAt">) => RuntimeJob;
  getJob: (jobId: string) => RuntimeJob | undefined;
  saveJob: (job: RuntimeJob) => RuntimeJob;
  listJobs: (limit: number) => RuntimeJob[];
  poolStatus: () => RuntimePoolStatus[];
};

const nowIso = (): string => new Date().toISOString();

const createPool = (runtime: RuntimeKind): RuntimePoolStatus => ({
  runtime,
  activeJobs: 0,
  completedJobs: 0,
  failedJobs: 0,
});

export const createInMemoryRuntimeStore = (): RuntimeStore => {
  const jobs = new Map<string, RuntimeJob>();
  const pools = new Map<RuntimeKind, RuntimePoolStatus>([
    ["node", createPool("node")],
    ["python", createPool("python")],
  ]);

  const statusFromJob = (job: RuntimeJob, previous?: RuntimeJob): void => {
    const pool = pools.get(job.runtime);
    if (!pool) {
      return;
    }
    if (previous?.status === "running") {
      pool.activeJobs = Math.max(0, pool.activeJobs - 1);
    }
    if (job.status === "running" && previous?.status !== "running") {
      pool.activeJobs += 1;
    }
    if (job.status === "succeeded" && previous?.status !== "succeeded") {
      pool.completedJobs += 1;
    }
    if ((job.status === "failed" || job.status === "rejected") && previous?.status !== job.status) {
      pool.failedJobs += 1;
    }
  };

  return {
    createJob: (job) => {
      const record: RuntimeJob = {
        ...job,
        createdAt: nowIso(),
        updatedAt: nowIso(),
      };
      jobs.set(record.id, record);
      statusFromJob(record);
      return record;
    },
    getJob: (jobId) => jobs.get(jobId),
    saveJob: (job) => {
      const previous = jobs.get(job.id);
      const record: RuntimeJob = {
        ...job,
        updatedAt: nowIso(),
      };
      jobs.set(record.id, record);
      statusFromJob(record, previous);
      return record;
    },
    listJobs: (limit) =>
      [...jobs.values()]
        .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt))
        .slice(0, Math.max(0, limit)),
    poolStatus: () => [...pools.values()],
  };
};
