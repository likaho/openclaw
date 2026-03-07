#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const argMap = new Map();
for (let i = 2; i < process.argv.length; i += 1) {
  const arg = process.argv[i];
  if (!arg.startsWith("--")) {
    continue;
  }
  const key = arg.slice(2);
  const value =
    process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : "true";
  argMap.set(key, value);
}

const namespace = argMap.get("namespace") ?? process.env.OPENCLAW_NAMESPACE ?? "openclaw-local";
const targetDeployment =
  argMap.get("target") ?? process.env.RESILIENCE_TARGET_DEPLOYMENT ?? "orchestration-service";
const probeDeployment =
  argMap.get("probe") ?? process.env.RESILIENCE_PROBE_DEPLOYMENT ?? "conversation-service-hostpath";
const timeoutSeconds = Number.parseInt(
  argMap.get("timeout") ?? process.env.RESILIENCE_ROLLOUT_TIMEOUT_SECONDS ?? "240",
  10,
);

const runKubectl = (args, options = {}) => {
  const started = Date.now();
  const output = execFileSync("kubectl", args, {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
  return {
    elapsedMs: Date.now() - started,
    output: output.trim(),
  };
};

const main = async () => {
  const report = {
    checkedAt: new Date().toISOString(),
    namespace,
    targetDeployment,
    probeDeployment,
    timeoutSeconds,
    steps: [],
    ok: false,
  };

  try {
    const restart = runKubectl([
      "-n",
      namespace,
      "rollout",
      "restart",
      `deployment/${targetDeployment}`,
    ]);
    report.steps.push({
      name: "rollout_restart",
      ok: true,
      elapsedMs: restart.elapsedMs,
      output: restart.output,
    });

    const status = runKubectl(
      [
        "-n",
        namespace,
        "rollout",
        "status",
        `deployment/${targetDeployment}`,
        `--timeout=${timeoutSeconds}s`,
      ],
      { maxBuffer: 10 * 1024 * 1024 },
    );
    report.steps.push({
      name: "rollout_status",
      ok: true,
      elapsedMs: status.elapsedMs,
      output: status.output,
    });

    const readiness = runKubectl([
      "-n",
      namespace,
      "exec",
      `deployment/${probeDeployment}`,
      "--",
      "node",
      "/workspace/scripts/enterprise-readiness-check.mjs",
    ]);

    const readinessReport = JSON.parse(readiness.output);
    report.steps.push({
      name: "post_restart_readiness",
      ok: readinessReport.ok === true,
      elapsedMs: readiness.elapsedMs,
      readiness: readinessReport,
    });

    report.ok = report.steps.every((step) => step.ok);
    console.log(JSON.stringify(report, null, 2));
    if (!report.ok) {
      process.exitCode = 1;
    }
  } catch (error) {
    report.steps.push({
      name: "error",
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
    report.ok = false;
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  }
};

await main();
