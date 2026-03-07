# Milestone 17: Enterprise Web Portal Complete

Date: March 7, 2026

## Scope completed

- Implemented `@openclaw/enterprise-portal` browser app + backend proxy.
- Added browser onboarding pages for:
  - signup
  - invite acceptance
  - login/callback/refresh/logout
  - bootstrap + setup complete
  - channel catalog/connect/verify
  - skills catalog/install/configure
- Wired portal runtime to onboarding + identity services in local Kubernetes.
- Added kubectl-only hostPath deployment path for non-kind local clusters.
- Updated architecture/component docs to include implemented portal service and local K8s wiring.

## Files changed

- `packages/enterprise-portal/package.json`
- `packages/enterprise-portal/tsconfig.json`
- `packages/enterprise-portal/vitest.config.ts`
- `packages/enterprise-portal/Dockerfile`
- `packages/enterprise-portal/README.md`
- `packages/enterprise-portal/src/config.ts`
- `packages/enterprise-portal/src/index.ts`
- `packages/enterprise-portal/src/proxy.ts`
- `packages/enterprise-portal/src/proxy.test.ts`
- `packages/enterprise-portal/src/server.ts`
- `packages/enterprise-portal/src/static/index.html`
- `packages/enterprise-portal/src/static/app.js`
- `packages/enterprise-portal/src/static/styles.css`
- `deploy/k8s/local/enterprise-portal.yaml`
- `deploy/k8s/local/enterprise-portal-hostpath.yaml`
- `deploy/k8s/local/README.md`
- `docs/design/2-Executive-architecture-plan.md`
- `docs/design/4-Component-and-system-architecture-diagrams-plan-milestones.md`
- `docs/design/enterprise-microservices.md`
- `docs/design/29-Enterprise-browser-onboarding-user-guide.md`

## Unit test commands and results

1. `pnpm --filter @openclaw/enterprise-portal test`
   - Result: pass (`2/2` tests)
2. `pnpm --filter @openclaw/enterprise-portal exec tsc -p tsconfig.json --noEmit`
   - Result: pass

## Deployment commands and results (local K8s cluster)

1. `kubectl apply -f deploy/k8s/local/enterprise-portal-hostpath.yaml`
   - Result: deployment + service created
2. `kubectl -n openclaw-local rollout status deployment/enterprise-portal-hostpath --timeout=240s`
   - Result: successfully rolled out
3. `kubectl -n openclaw-local get pods -l app=enterprise-portal-hostpath -o wide`
   - Result: `1/1 Running`
4. `kubectl -n openclaw-local logs deployment/enterprise-portal-hostpath --tail=120`
   - Result: `enterprise-portal listening on :4020`
5. `kubectl -n openclaw-local port-forward svc/enterprise-portal-hostpath 18788:4020`
   - Result: browser endpoint active at `http://localhost:18788/`

## Smoke verification steps and results

1. In-cluster portal page check:
   - command: `kubectl -n openclaw-local exec deployment/onboarding-service-hostpath -- node -e "... fetch('http://enterprise-portal-hostpath:4020/') ..."`
   - result: HTTP 200 + expected portal HTML marker
2. In-cluster portal API proxy checks:
   - signup via `/api/onboarding/signup` -> `201`
   - channels catalog via `/api/channels/catalog` -> `200`, `count=10`
   - skills catalog via `/api/skills/catalog` -> `200`, `count=3`
   - bootstrap via `/api/onboarding/bootstrap` -> `201`

## Evidence

```json
{
  "milestone": "17",
  "unitTests": { "pass": true, "tests": 2 },
  "typecheck": { "pass": true },
  "deployment": {
    "rollout": "pass",
    "podReady": true,
    "service": "enterprise-portal-hostpath:4020"
  },
  "smoke": {
    "portalHtml": true,
    "signup": 201,
    "channelsCatalog": 200,
    "skillsCatalog": 200,
    "bootstrap": 201
  }
}
```

## Regression check

1. `kubectl -n openclaw-local exec deployment/conversation-service-hostpath -- node /workspace/scripts/enterprise-readiness-check.mjs`
   - Result: pass (`ok=true`)
2. `node scripts/enterprise-resilience-check.mjs`
   - Result: pass (`ok=true`)

## Known follow-ups

- Add dedicated UI test suite for browser interactions (form validation and callback handling).
- Integrate credential broker-backed secret entry UI for real channel credential capture.
- Add production ingress routing for portal hostname (currently verified with local port-forward).
