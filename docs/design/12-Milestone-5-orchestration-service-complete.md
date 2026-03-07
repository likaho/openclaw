# Milestone 5 Orchestration Service Complete

## Scope completed

- Implemented Orchestration service MVP under `packages/orchestration-service`.
- Added workflow lifecycle endpoints:
  - create workflow (`/v1/orchestration/workflows`) with dedupe support
  - transition workflow (`/v1/orchestration/workflows/:workflowId/transition`)
  - list workflows (`/v1/orchestration/workflows`)
- Added workflow state model (`queued`, `running`, `retrying`, `succeeded`, `failed`).
- Added retry scheduling with exponential backoff and max-attempt failure cutoff.
- Added idempotent create behavior via tenant + dedupe key.
- Added local K8s manifest for Orchestration service.
- Added Orchestration service design/OpenAPI docs for Milestone 5.

## Files changed

- `packages/orchestration-service/package.json`
- `packages/orchestration-service/tsconfig.json`
- `packages/orchestration-service/vitest.config.ts`
- `packages/orchestration-service/README.md`
- `packages/orchestration-service/Dockerfile`
- `packages/orchestration-service/src/config.ts`
- `packages/orchestration-service/src/workflow.ts`
- `packages/orchestration-service/src/workflow.test.ts`
- `packages/orchestration-service/src/store.ts`
- `packages/orchestration-service/src/store.test.ts`
- `packages/orchestration-service/src/routes/workflows.ts`
- `packages/orchestration-service/src/routes/workflows.test.ts`
- `packages/orchestration-service/src/server.ts`
- `packages/orchestration-service/src/index.ts`
- `deploy/k8s/local/orchestration-service.yaml`
- `deploy/k8s/local/README.md`
- `docs/design/enterprise-orchestration-service.md`
- `docs/design/enterprise-orchestration-service.openapi.yml`

## Test steps performed

1. Package unit tests:
   - `pnpm --filter @openclaw/orchestration-service test`
   - Result: pass (`3` files, `7` tests).
2. Package typecheck:
   - `pnpm --filter @openclaw/orchestration-service exec tsc -p tsconfig.json --noEmit`
   - Result: pass.
3. Local K8s deployment (smoke path):
   - Applied hostPath runtime deployment for `orchestration-service` in `openclaw-local`.
   - Verified rollout and startup log (`Orchestration service listening on :4005`).
4. In-cluster API smoke script validations:
   - create workflow returns `201`
   - duplicate create returns `200` with `dedupe_hit`
   - transition `start` moves workflow to `running`
   - transition `failure` moves workflow to `retrying` and sets `nextRetryAt`
   - transition `start` from retrying increments attempt and moves to `running`
   - transition `failure` at max attempts moves workflow to `failed`
   - list endpoint returns workflow records
   - consolidated result:

```json
{
  "create": "ok",
  "dedupeHit": "ok",
  "start": "ok",
  "failureRetry": "ok",
  "retryStart": "ok",
  "finalFailure": "ok",
  "list": "ok"
}
```

## Known follow-ups

- Replace in-memory workflow store with Redis/Postgres + durable queue backing.
- Add explicit scheduled retry worker loop and queue dispatch integration.
- Replace hostPath smoke deployment with standard image workflow when local runtime image import path is available.
