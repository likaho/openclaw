# Milestone 1 Stabilization Complete (Identity service hardening)

## Scope completed

- Stabilized `@openclaw/identity-service` test and typecheck flow.
- Added package-local Vitest config so tests do not rely on root `test/setup.ts`.
- Fixed async store usage in auth routes and store tests.
- Wired runtime session store selection:
  - Postgres-backed session store when `DATABASE_URL` is set.
  - In-memory session store otherwise.
- Wired schema bootstrap for Postgres mode on service startup.
- Implemented `/v1/auth/logout` refresh-token revocation behavior.
- Strengthened auth-path tests for callback, refresh, session-not-found, and logout invalid token behavior.
- Ensured refresh token rotation produces unique tokens by adding JWT `jti`.
- Aligned Identity service docs/OpenAPI with current request/response and data model behavior.

## Files changed

- `packages/identity-service/src/routes/auth.ts`
- `packages/identity-service/src/routes/auth.test.ts`
- `packages/identity-service/src/store.ts`
- `packages/identity-service/src/store.test.ts`
- `packages/identity-service/src/tokens.ts`
- `packages/identity-service/src/index.ts`
- `packages/identity-service/src/server.ts`
- `packages/identity-service/package.json`
- `packages/identity-service/vitest.config.ts`
- `docs/design/enterprise-identity-service.md`
- `docs/design/enterprise-identity-service.openapi.yml`

## Verification

- `pnpm --filter @openclaw/identity-service test`
  - Result: pass (`4` files, `11` tests).
- `pnpm --filter @openclaw/identity-service exec tsc -p tsconfig.json --noEmit`
  - Result: pass.

## Known follow-ups

- Local Kubernetes OIDC smoke flow (`login -> callback -> refresh -> logout`) still needs live-cluster execution for final Milestone 1 sign-off.
- Session revocation is currently refresh-token based; full session invalidation across all issued refresh tokens is not yet modeled.
