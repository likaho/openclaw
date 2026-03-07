### ✅ Milestone 1 scaffolding complete (Identity service + tests + local K8s)

I scaffolded the Identity service codebase, added token mint/validation unit tests, and created local K8s manifests for Keycloak + Identity service.

## New service scaffold
- `packages/identity-service/` with config, server, auth routes, token helpers
- `packages/identity-service/src/tokens.test.ts` with initial token tests
- `packages/identity-service/tsconfig.json`
- `packages/identity-service/Dockerfile`

## Local K8s manifests
- `deploy/k8s/local/README.md`
- `deploy/k8s/local/namespace.yaml`
- `deploy/k8s/local/keycloak-values.yaml`
- `deploy/k8s/local/identity-service.yaml`

## How to run tests locally
```bash
pnpm install
pnpm --filter @openclaw/identity-service test
```

## How to deploy to local K8s
```bash
kubectl apply -f deploy/k8s/local/namespace.yaml
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update
helm install openclaw-keycloak bitnami/keycloak \
  --namespace openclaw-local \
  --create-namespace \
  -f deploy/k8s/local/keycloak-values.yaml

docker build -t openclaw/identity-service:local -f packages/identity-service/Dockerfile .
kind load docker-image openclaw/identity-service:local
kubectl apply -f deploy/k8s/local/identity-service.yaml
kubectl -n openclaw-local port-forward svc/identity-service 4001:4001
```

## Next milestone tasks (pending your sign off)
- Implement real Keycloak code exchange and claim mapping
- Persist session and refresh tokens
- Add tenant resolution hooks to Tenant service

If you want, I can proceed with the Keycloak exchange logic and session persistence next.

https://docs.openclaw.ai/design/enterprise-microservices
https://docs.openclaw.ai/design/enterprise-identity-service
 
