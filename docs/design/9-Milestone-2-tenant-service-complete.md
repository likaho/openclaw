# Milestone 2 Tenant Service Complete

## Scope completed

- Implemented Tenant service MVP under `packages/tenant-service`.
- Added tenant/workspace lifecycle APIs:
  - create/get/update tenant
  - create/get workspace scoped by tenant
- Added quota and policy validation:
  - positive integer quota checks
  - duplicate policy rejection
- Added tenant-isolation behavior for workspace lookup (`tenantId` + `workspaceId` boundary).
- Added local K8s manifest for tenant service (`deploy/k8s/local/tenant-service.yaml`).
- Added Tenant service architecture/OpenAPI docs for Milestone 2.

## Files changed

- `packages/tenant-service/package.json`
- `packages/tenant-service/tsconfig.json`
- `packages/tenant-service/vitest.config.ts`
- `packages/tenant-service/README.md`
- `packages/tenant-service/Dockerfile`
- `packages/tenant-service/src/config.ts`
- `packages/tenant-service/src/store.ts`
- `packages/tenant-service/src/store.test.ts`
- `packages/tenant-service/src/routes/tenants.ts`
- `packages/tenant-service/src/routes/tenants.test.ts`
- `packages/tenant-service/src/server.ts`
- `packages/tenant-service/src/index.ts`
- `deploy/k8s/local/tenant-service.yaml`
- `deploy/k8s/local/README.md`
- `docs/design/enterprise-tenant-service.md`
- `docs/design/enterprise-tenant-service.openapi.yml`

## Test steps performed

1. Package-level unit tests:
   - `pnpm --filter @openclaw/tenant-service test`
   - Result: pass (`2` files, `3` tests).
2. Package-level typecheck:
   - `pnpm --filter @openclaw/tenant-service exec tsc -p tsconfig.json --noEmit`
   - Result: pass.
3. Local K8s deployment (smoke path):
   - Applied hostPath runtime deployment for `tenant-service` in `openclaw-local`.
   - Verified rollout and startup log (`Tenant service listening on :4002`).
4. In-cluster API smoke script validations:
   - create tenant A (`201`)
   - create tenant B (`201`)
   - invalid quota rejected (`400`)
   - duplicate policies rejected (`400`)
   - create workspace under tenant A (`201`)
   - lookup workspace under tenant A (`200`)
   - lookup same workspace under tenant B (`404`) for isolation
   - update tenant A (`200`)
   - consolidated result:

```json
{
  "createTenant": "ok",
  "createTenantB": "ok",
  "invalidQuota": "ok",
  "duplicatePolicies": "ok",
  "createWorkspace": "ok",
  "workspaceLookup": "ok",
  "tenantIsolation": "ok",
  "updateTenant": "ok"
}
```

## Known follow-ups

- Current Tenant service persistence is in-memory only; migrate to Postgres for durable state.
- Add service-to-service integration from Identity service tenant resolution into Tenant service APIs.
- Replace hostPath smoke deployment with standard image workflow once local image import/registry path is available.
