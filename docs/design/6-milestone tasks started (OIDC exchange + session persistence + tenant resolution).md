### ✅ Next milestone tasks started (OIDC exchange + session persistence + tenant resolution)

I implemented Keycloak code exchange and ID token verification, added in-memory session/refresh token persistence with rotation, and added tenant resolution hooks plus tests.

## What changed
- **OIDC integration**: `packages/identity-service/src/oidc.ts`
  - OIDC discovery, token exchange, ID token verification via JWKS
- **Session persistence**: `packages/identity-service/src/store.ts`
  - In-memory session store, refresh token rotation, state store
- **Tenant resolution**: `packages/identity-service/src/tenant.ts`
  - Tenant mapping via `tenant_id` or email domain fallback
- **Auth routes updated**: `packages/identity-service/src/routes/auth.ts`
  - Uses Keycloak exchange + verified claims + session storage
- **Tests**: `store.test.ts`, `tenant.test.ts`
- **OpenAPI**: Login response updated with optional `tenantHint`

## Run tests
```bash
pnpm install
pnpm --filter @openclaw/identity-service test
```

## Notes
- Session persistence is currently in-memory. Next step is swapping to a database-backed store.
- Keycloak must have a realm `openclaw` and client `openclaw-identity` with the callback URL configured.

If you want, I can proceed with database persistence and a minimal migration next, or wire this to a Tenant service stub.

https://docs.openclaw.ai/design/enterprise-microservices
https://docs.openclaw.ai/design/enterprise-identity-service
