# Milestone 14 Skills Catalog Install Configure UX Complete

## Scope completed

- Implemented skills catalog endpoint with eligibility/missing requirement hints.
- Implemented skill install endpoint with success/failure lifecycle events.
- Implemented skill configure endpoint for per-user enable/env config.

## Files changed

- `packages/onboarding-service/src/store.ts`
- `packages/onboarding-service/src/routes/skills.ts`
- `packages/onboarding-service/src/skills.test.ts`
- `docs/design/enterprise-onboarding-ux.openapi.yml`
- `docs/design/enterprise-onboarding-events.asyncapi.yml`

## Unit test commands/results

1. `pnpm --filter @openclaw/onboarding-service exec vitest run src/skills.test.ts --config vitest.config.ts`
   - Result: pass (`1` file, `2` tests).
2. `pnpm --filter @openclaw/onboarding-service exec tsc -p tsconfig.json --noEmit`
   - Result: pass.

## Deployment commands/results

1. `kubectl apply -f /tmp/onboarding-service-hostpath.yaml`
   - Result: applied.
2. `kubectl -n openclaw-local rollout status deployment/onboarding-service-hostpath --timeout=240s`
   - Result: rollout successful.
3. In-cluster skills smoke script.
   - Result: `skillCatalogCount=3`, `skillInstallStatus=201`, `skillConfigureStatus=200`.

## Evidence

```json
{
  "skillCatalogCount": 3,
  "skillInstallStatus": 201,
  "skillConfigureStatus": 200
}
```

## Regression check

- Readiness and resilience checks returned `ok: true`.

## Known follow-ups

- Wire real ClawHub/skills status endpoints for live eligibility and installer actions.
