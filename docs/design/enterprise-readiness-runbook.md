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
- `auditResult.ok` is `true`

## Failure response

1. Identify failing target from `healthResults`.
2. Inspect rollout status:
   - `kubectl -n openclaw-local rollout status deployment/<service> --timeout=180s`
3. Inspect logs:
   - `kubectl -n openclaw-local logs deployment/<service> --tail=200`
4. Re-run readiness script after remediation.

## Notes

- Endpoint URLs can be overridden via environment variables (`*_HEALTH_URL`, `CONVERSATION_BASE_URL`).
- Script exits non-zero when checks fail to support CI/CD gating.
