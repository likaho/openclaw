# Milestone 6 Skill Control Service Complete

## Scope completed

- Implemented Skill Control service MVP under `packages/skill-control-service`.
- Added tenant skill policy endpoint:
  - `/v1/skills/policies`
- Added skill artifact intake endpoint:
  - `/v1/skills/artifacts`
  - signature verification (HMAC SHA-256)
  - admission evaluation (trusted skill, runtime, capability profile)
- Added rollout endpoint:
  - `/v1/skills/rollouts`
  - stage validation (`dev`, `canary`, `general`)
  - canary percentage rule enforcement (`1..50`)
- Added rollout list endpoint:
  - `/v1/skills/rollouts/:tenantId/:skillId`
- Added local K8s manifest for Skill Control service.
- Added Skill Control design/OpenAPI docs for Milestone 6.

## Files changed

- `packages/skill-control-service/package.json`
- `packages/skill-control-service/tsconfig.json`
- `packages/skill-control-service/vitest.config.ts`
- `packages/skill-control-service/README.md`
- `packages/skill-control-service/Dockerfile`
- `packages/skill-control-service/src/config.ts`
- `packages/skill-control-service/src/types.ts`
- `packages/skill-control-service/src/signature.ts`
- `packages/skill-control-service/src/signature.test.ts`
- `packages/skill-control-service/src/admission.ts`
- `packages/skill-control-service/src/admission.test.ts`
- `packages/skill-control-service/src/store.ts`
- `packages/skill-control-service/src/routes/skills.ts`
- `packages/skill-control-service/src/routes/skills.test.ts`
- `packages/skill-control-service/src/server.ts`
- `packages/skill-control-service/src/index.ts`
- `deploy/k8s/local/skill-control-service.yaml`
- `deploy/k8s/local/README.md`
- `docs/design/enterprise-skill-control-service.md`
- `docs/design/enterprise-skill-control-service.openapi.yml`

## Test steps performed

1. Package unit tests:
   - `pnpm --filter @openclaw/skill-control-service test`
   - Result: pass (`3` files, `6` tests).
2. Package typecheck:
   - `pnpm --filter @openclaw/skill-control-service exec tsc -p tsconfig.json --noEmit`
   - Result: pass.
3. Local K8s deployment (smoke path):
   - Applied hostPath runtime deployment for `skill-control-service` in `openclaw-local`.
   - Verified rollout and startup log (`Skill control service listening on :4006`).
4. In-cluster API smoke script validations:
   - set tenant policy (`201`)
   - invalid artifact signature rejected (`400`)
   - valid signed artifact admitted (`201`, `admitted=true`)
   - invalid canary percent rejected (`400`)
   - valid canary rollout accepted (`201`)
   - non-canary rollout with canary percent rejected (`400`)
   - rollout list returns expected single rollout record
   - consolidated result:

```json
{
  "setPolicy": "ok",
  "badSignatureRejected": "ok",
  "artifactAdmitted": "ok",
  "invalidCanaryRejected": "ok",
  "canaryRollout": "ok",
  "invalidGeneralRejected": "ok",
  "rolloutList": "ok"
}
```

## Known follow-ups

- Replace in-memory storage with durable metadata persistence.
- Add artifact attestation/SBOM provenance checks beyond HMAC signature.
- Integrate rollout policy with runtime scheduler and tenant-level rollout approvals.
- Replace hostPath smoke deployment with standard image workflow when local runtime image import path is available.
