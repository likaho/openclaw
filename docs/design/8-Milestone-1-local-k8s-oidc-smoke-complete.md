# Milestone 1 Local K8s OIDC Smoke Complete

## Scope completed

- Deployed `openclaw-local` namespace.
- Deployed Keycloak for local OIDC smoke in `openclaw-local`.
- Configured Keycloak realm/client/user for Identity service callback testing.
- Deployed Identity service into local Kubernetes and verified service startup.
- Executed end-to-end in-cluster smoke flow:
  - `login`
  - `callback`
  - `refresh`
  - `logout`
  - revoked refresh token validation (`401` expected)

## Deployment notes

- The Bitnami Helm Keycloak chart (`bitnami/keycloak`) failed in this environment due image pull errors (`docker.io/bitnami/*: not found`).
- For smoke validation, Keycloak was deployed directly using `quay.io/keycloak/keycloak:latest`.
- Identity service image loading into node containerd was blocked by runtime socket permissions.
- For smoke validation, Identity service was deployed with `node:22-slim` + hostPath mount of this repo, running `packages/identity-service/src/index.ts` in-cluster.

## Verification evidence

- Identity service startup log:
  - `Identity service listening on :4001`
- In-cluster smoke script result:

```json
{
  "login": "ok",
  "callback": "ok",
  "refresh": "ok",
  "logout": "ok",
  "revokedRefresh": "ok",
  "tenantId": "example-com",
  "workspaceId": "default",
  "subject": "5906414f-2b3e-4658-94b9-62c38d030d55"
}
```

## Test steps performed

1. Prepared local namespace and checked cluster access:
   - `kubectl apply -f deploy/k8s/local/namespace.yaml`
   - `kubectl get ns openclaw-local`
2. Attempted canonical Keycloak Helm path and captured failure:
   - `helm upgrade --install openclaw-keycloak bitnami/keycloak --namespace openclaw-local --create-namespace -f deploy/k8s/local/keycloak-values.yaml`
   - `kubectl -n openclaw-local describe pod openclaw-keycloak-0` (`ErrImagePull`, `docker.io/bitnami/keycloak:* not found`)
3. Deployed fallback Keycloak workload (quay image) and waited for readiness.
4. Configured OIDC objects inside Keycloak pod:
   - created realm `openclaw`
   - created client `openclaw-identity` with redirect URI `http://localhost:4001/v1/auth/callback`
   - created user `alice` and set password/profile fields
5. Built and deployed Identity service for in-cluster execution:
   - built image: `docker build -t openclaw/identity-service:local -f packages/identity-service/Dockerfile .`
   - runtime import failed due containerd permission
   - deployed fallback hostPath workload and checked logs/readiness
6. Ran in-cluster scripted flow from Identity service pod:
   - POST `/v1/auth/login`
   - followed Keycloak login form submit (`alice` / `alicepass`)
   - GET callback URL returned by Keycloak redirect
   - POST `/v1/auth/refresh`
   - POST `/v1/auth/logout`
   - POST `/v1/auth/refresh` using revoked refresh token and validated `401`
7. Recorded final structured smoke output JSON (shown above).

## Known follow-ups

- Replace smoke-only Keycloak deployment with the canonical chart path once image source/tag policy is fixed.
- Replace hostPath Identity deployment with the standard built image flow (or registry push) once container runtime image import permissions are available.
