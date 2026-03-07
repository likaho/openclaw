import type { RuntimeJob } from "./types.js";

export const executeRuntimeJob = async (job: RuntimeJob): Promise<RuntimeJob> => {
  if (job.payload.includes("FAIL")) {
    return {
      ...job,
      status: "failed",
      error: "runtime_execution_error",
      result: undefined,
    };
  }

  // Simulated runtime execution path for milestone validation.
  const result =
    job.runtime === "node"
      ? `node:${job.skillId}:${job.payload.length}`
      : `python:${job.skillId}:${job.payload.length}`;

  return {
    ...job,
    status: "succeeded",
    error: undefined,
    result,
  };
};
