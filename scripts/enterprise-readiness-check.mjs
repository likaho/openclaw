#!/usr/bin/env node

const parseInteger = (value, fallback) => {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallback;
  }
  return parsed;
};

const maxHealthLatencyMs = parseInteger(process.env.READINESS_MAX_HEALTH_LATENCY_MS, 1500);
const maxAuditLatencyMs = parseInteger(process.env.READINESS_MAX_AUDIT_LATENCY_MS, 2000);

const targets = [
  {
    name: "identity-service",
    url:
      process.env.IDENTITY_HEALTH_URL ??
      "http://identity-service.openclaw-local.svc.cluster.local:4001/healthz",
  },
  {
    name: "tenant-service",
    url:
      process.env.TENANT_HEALTH_URL ??
      "http://tenant-service.openclaw-local.svc.cluster.local:4002/healthz",
  },
  {
    name: "policy-service",
    url:
      process.env.POLICY_HEALTH_URL ??
      "http://policy-service.openclaw-local.svc.cluster.local:4003/healthz",
  },
  {
    name: "channel-ingress-service",
    url:
      process.env.CHANNEL_INGRESS_HEALTH_URL ??
      "http://channel-ingress-service.openclaw-local.svc.cluster.local:4004/healthz",
  },
  {
    name: "orchestration-service",
    url:
      process.env.ORCHESTRATION_HEALTH_URL ??
      "http://orchestration-service.openclaw-local.svc.cluster.local:4005/healthz",
  },
  {
    name: "skill-control-service",
    url:
      process.env.SKILL_CONTROL_HEALTH_URL ??
      "http://skill-control-service.openclaw-local.svc.cluster.local:4006/healthz",
  },
  {
    name: "skill-runtime-service",
    url:
      process.env.SKILL_RUNTIME_HEALTH_URL ??
      "http://skill-runtime-service.openclaw-local.svc.cluster.local:4007/healthz",
  },
  {
    name: "conversation-service",
    url:
      process.env.CONVERSATION_HEALTH_URL ??
      "http://conversation-service-hostpath.openclaw-local.svc.cluster.local:4008/healthz",
  },
];

const checkHealth = async (target) => {
  const started = Date.now();
  try {
    const response = await fetch(target.url, {
      method: "GET",
      headers: { accept: "application/json" },
    });
    const elapsedMs = Date.now() - started;
    let body;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    return {
      name: target.name,
      url: target.url,
      ok: response.status >= 200 && response.status < 300,
      status: response.status,
      elapsedMs,
      body,
    };
  } catch (error) {
    return {
      name: target.name,
      url: target.url,
      ok: false,
      status: 0,
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const checkConversationAudit = async () => {
  const base =
    process.env.CONVERSATION_BASE_URL ??
    "http://conversation-service-hostpath.openclaw-local.svc.cluster.local:4008";
  const started = Date.now();
  try {
    const write = await fetch(`${base}/v1/audit/events`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "tenant-a",
        eventType: "readiness.check",
        actor: "enterprise-readiness-check",
        payload: {
          source: "milestone-9",
        },
      }),
    });
    if (write.status !== 201) {
      return { ok: false, status: write.status, error: "audit_write_failed" };
    }
    const verify = await fetch(`${base}/v1/audit/verify/tenant-a`);
    const verifyBody = await verify.json();
    const elapsedMs = Date.now() - started;
    return {
      ok: verify.status === 200 && verifyBody.valid === true,
      status: verify.status,
      elapsedMs,
      body: verifyBody,
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      elapsedMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

const main = async () => {
  const healthResults = await Promise.all(targets.map((target) => checkHealth(target)));
  const auditResult = await checkConversationAudit();
  const healthWithSlo = healthResults.map((entry) => ({
    ...entry,
    latencySloOk: entry.elapsedMs <= maxHealthLatencyMs,
  }));
  const auditWithSlo = {
    ...auditResult,
    latencySloOk: auditResult.elapsedMs <= maxAuditLatencyMs,
  };
  const ok =
    healthWithSlo.every((entry) => entry.ok && entry.latencySloOk) &&
    auditWithSlo.ok &&
    auditWithSlo.latencySloOk;

  const report = {
    checkedAt: new Date().toISOString(),
    thresholds: {
      maxHealthLatencyMs,
      maxAuditLatencyMs,
    },
    ok,
    healthResults: healthWithSlo,
    auditResult: auditWithSlo,
  };

  console.log(JSON.stringify(report, null, 2));
  if (!ok) {
    process.exitCode = 1;
  }
};

await main();
