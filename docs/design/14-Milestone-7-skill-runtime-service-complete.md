# Milestone 7 Skill Runtime Service Complete

## Scope completed

- Implemented Skill Runtime service MVP under `packages/skill-runtime-service`.
- Added runtime job execution endpoint:
  - `/v1/runtime/jobs` (submit + execute)
- Added job retrieval/list endpoints:
  - `/v1/runtime/jobs/:jobId`
  - `/v1/runtime/jobs`
- Added runtime pool status endpoint:
  - `/v1/runtime/pools`
- Added runtime guardrails:
  - supported runtime check (`node`, `python`)
  - capability profile allowlist
  - timeout and memory limits
- Added separate execution paths for Node and Python runtimes (MVP simulated executor).
- Added local K8s manifest for Skill Runtime service.
- Added Skill Runtime design/OpenAPI docs for Milestone 7.

## Files changed

- `packages/skill-runtime-service/package.json`
- `packages/skill-runtime-service/tsconfig.json`
- `packages/skill-runtime-service/vitest.config.ts`
- `packages/skill-runtime-service/README.md`
- `packages/skill-runtime-service/Dockerfile`
- `packages/skill-runtime-service/src/config.ts`
- `packages/skill-runtime-service/src/types.ts`
- `packages/skill-runtime-service/src/guards.ts`
- `packages/skill-runtime-service/src/guards.test.ts`
- `packages/skill-runtime-service/src/store.ts`
- `packages/skill-runtime-service/src/store.test.ts`
- `packages/skill-runtime-service/src/executor.ts`
- `packages/skill-runtime-service/src/executor.test.ts`
- `packages/skill-runtime-service/src/routes/runtime.ts`
- `packages/skill-runtime-service/src/routes/runtime.test.ts`
- `packages/skill-runtime-service/src/server.ts`
- `packages/skill-runtime-service/src/index.ts`
- `deploy/k8s/local/skill-runtime-service.yaml`
- `deploy/k8s/local/README.md`
- `docs/design/enterprise-skill-runtime-service.md`
- `docs/design/enterprise-skill-runtime-service.openapi.yml`

## Test steps performed

1. Package unit tests:
   - `pnpm --filter @openclaw/skill-runtime-service test`
   - Result: pass (`4` files, `8` tests).
2. Package typecheck:
   - `pnpm --filter @openclaw/skill-runtime-service exec tsc -p tsconfig.json --noEmit`
   - Result: pass.
3. Local K8s deployment (smoke path):
   - Applied hostPath runtime deployment for `skill-runtime-service` in `openclaw-local`.
   - Verified rollout and startup log (`Skill runtime service listening on :4007`).
4. In-cluster API smoke script validations:
   - node runtime job executes successfully
   - python runtime job executes successfully
   - disallowed capability rejected (`400`)
   - excessive timeout rejected (`400`)
   - excessive memory rejected (`400`)
   - explicit failure payload yields failed job state
   - pool status endpoint returns both runtime pools
   - consolidated result:

```json
{
  "nodeJob": "ok",
  "pythonJob": "ok",
  "capabilityGuard": "ok",
  "timeoutGuard": "ok",
  "memoryGuard": "ok",
  "failurePath": "ok",
  "poolStatus": "ok"
}
```

## Known follow-ups

- Replace simulated executor with isolated runtime workers and job queue handoff.
- Add strict sandbox controls (seccomp/AppArmor/gVisor/Kata) in runtime deployment layer.
- Add explicit CPU quota enforcement and execution timeout cancellation semantics.
- Replace hostPath smoke deployment with standard image workflow when local runtime image import path is available.
