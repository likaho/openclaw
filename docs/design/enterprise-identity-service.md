# Enterprise Identity Service (Milestone 1)

This document defines the Milestone 1 Identity and SSO service, including the open-source OIDC provider choice, API contract outline, unit test scope, and local Kubernetes testing loop.

## Goals

- Provide tenant-aware SSO login using OIDC (with SAML support through the IdP)
- Issue JWTs containing `tenant_id`, `workspace_id`, `roles`, `entitlements`
- Support refresh and logout flows
- Integrate cleanly with the Policy service for claim validation

## OIDC Provider Choice

We will use **Keycloak** as the open-source OIDC provider for Milestone 1.

Reasons:

- Enterprise friendly OIDC + SAML support
- Admin UI for tenant IdP setup and mapping
- Mature Helm chart for local Kubernetes

## Service Responsibilities

- Broker OIDC login with Keycloak
- Resolve tenant and workspace from IdP claims
- Mint OpenClaw access tokens and refresh tokens
- Publish audit events for login and token refresh

## Service Interfaces

- OpenAPI contract: `docs/design/enterprise-identity-service.openapi.yml`
- Internal dependency: Policy service for claim validation
- Internal dependency: Tenant service for tenant mapping

## Data Model (initial)

- `identity_sessions`
  - `id`
  - `tenant_id`
  - `workspace_id`
  - `subject`
  - `roles`
  - `entitlements`
  - `idp_issuer`
  - `idp_subject`
  - `created_at`
  - `expires_at`

- `identity_refresh_tokens`
  - `session_id`
  - `token_hash`
  - `expires_at`

## Key Flows

### Login flow

1. Client calls `/v1/auth/login` with tenant hint
2. Identity service redirects to Keycloak
3. Keycloak returns an auth code to `/v1/auth/callback`
4. Identity service exchanges code, maps tenant, validates claims
5. Identity service issues JWT + refresh token

### Refresh flow

1. Client calls `/v1/auth/refresh` with refresh token
2. Identity service validates token, rotates, issues new JWT

### Logout flow

1. Client calls `/v1/auth/logout`
2. Identity service revokes the provided refresh token

## Unit Test Scope

- Token minting and signature validation
- Claim mapping to tenant and workspace
- Rejection of invalid issuer, audience, or missing claims
- Refresh token rotation and expiry
- Logout revokes tokens and session
- Tenant mismatch detection

## Local Kubernetes Setup (Keycloak)

Suggested local workflow (documented commands, no execution here):

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm install openclaw-keycloak bitnami/keycloak \
  --namespace openclaw-local \
  --create-namespace \
  --set auth.adminUser=admin \
  --set auth.adminPassword=admin \
  --set production=false
```

Configure a realm and client in Keycloak for the Identity service callback URL.

## Milestone 1 Sign-off

- OIDC login works against local Keycloak
- JWT tokens include correct tenant claims
- Unit tests pass at >= 95 percent for auth logic
