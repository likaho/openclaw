# Milestone 11 Signup/Login + Invite UX Complete

## Scope completed

- Implemented onboarding backend endpoints for self-serve signup and invite acceptance.
- Added invite token lifecycle handling (single-use acceptance).
- Added service startup seed for invite-path smoke support.

## Files changed

- `packages/onboarding-service/src/store.ts`
- `packages/onboarding-service/src/routes/onboarding.ts`
- `packages/onboarding-service/src/index.ts`
- `packages/onboarding-service/src/store.test.ts`
- `docs/design/enterprise-onboarding-service.md`

## Unit test commands/results

1. `pnpm --filter @openclaw/onboarding-service exec vitest run src/store.test.ts --config vitest.config.ts`
   - Result: pass (`1` file, `3` tests).
2. `pnpm --filter @openclaw/onboarding-service exec tsc -p tsconfig.json --noEmit`
   - Result: pass.

## Deployment commands/results

1. `kubectl apply -f /tmp/onboarding-service-hostpath.yaml`
   - Result: deployment/service applied.
2. `kubectl -n openclaw-local rollout status deployment/onboarding-service-hostpath --timeout=240s`
   - Result: rollout successful.
3. In-cluster signup smoke via onboarding endpoints.
   - Result: signup succeeded and returned `userId`.

## Evidence

```json
{
  "signup": true,
  "inviteLifecycle": "validated-in-unit-tests",
  "bootstrapStatus": 201
}
```

## Regression check

- Readiness and resilience checks both returned `ok: true` after deployment.

## Known follow-ups

- Add dedicated admin invite-creation API and email verification workflow state.
