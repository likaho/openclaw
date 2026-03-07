# Enterprise Local Readiness Runbook

## Scope

This runbook defines the local Kubernetes readiness gate for Milestone 9 hardening.

## Prerequisites

- Namespace `openclaw-local` exists
- Milestones 1-8 services are deployed and healthy
- `conversation-service-hostpath` (or equivalent conversation service) is deployed

## Readiness gate command

Run from inside a pod with cluster DNS/network access:

```bash
kubectl -n openclaw-local exec deployment/conversation-service-hostpath -- \
  node /workspace/scripts/enterprise-readiness-check.mjs
```

## What the script verifies

- Health checks for:
  - `identity-service`
  - `tenant-service`
  - `policy-service`
  - `channel-ingress-service`
  - `orchestration-service`
  - `skill-control-service`
  - `skill-runtime-service`
  - `conversation-service`
- Conversation audit path:
  - appends a `readiness.check` audit event
  - verifies audit chain integrity (`/v1/audit/verify/tenant-a`)

## Pass criteria

- Output `ok: true`
- Every health target returns HTTP `200`
- Every health target meets latency SLO threshold (`READINESS_MAX_HEALTH_LATENCY_MS`, default `1500`)
- `auditResult.ok` is `true`
- Audit check meets latency SLO threshold (`READINESS_MAX_AUDIT_LATENCY_MS`, default `2000`)

## Failure response

1. Identify failing target from `healthResults`.
2. Inspect rollout status:
   - `kubectl -n openclaw-local rollout status deployment/<service> --timeout=180s`
3. Inspect logs:
   - `kubectl -n openclaw-local logs deployment/<service> --tail=200`
4. Re-run readiness script after remediation.

## Notes

- Endpoint URLs can be overridden via environment variables (`*_HEALTH_URL`, `CONVERSATION_BASE_URL`).
- Latency thresholds are configurable:
  - `READINESS_MAX_HEALTH_LATENCY_MS`
  - `READINESS_MAX_AUDIT_LATENCY_MS`
- Script exits non-zero when checks fail to support CI/CD gating.

## Resilience recovery gate

Run from your operator shell:

```bash
node scripts/enterprise-resilience-check.mjs --target orchestration-service
```

What it verifies:

- rollout restart succeeds for the target deployment
- rollout reaches ready state within timeout
- post-restart enterprise readiness gate still reports `ok: true`

Optional flags:

- `--namespace <name>` (default `openclaw-local`)
- `--target <deployment>` (default `orchestration-service`)
- `--probe <deployment>` pod used to run readiness script (default `conversation-service-hostpath`)
- `--timeout <seconds>` rollout timeout (default `240`)
