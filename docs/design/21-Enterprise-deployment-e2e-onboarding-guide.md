# OpenClaw Enterprise Deployment + End-to-End User Guide

## Scope

This guide assumes Milestones 1-9 are complete and shows how to:

- deploy the full local Enterprise stack on Kubernetes
- run end-to-end validation (health, resilience, auth, and channel path)
- onboard a first user (signup/login)
- configure channels (WhatsApp, Telegram, Slack)
- install and use skills from UI, CLI, and channel workflows

## 1) Prerequisites

- Kubernetes cluster (`kind`, `minikube`, or `k3d`)
- `kubectl`, `helm`, `docker`, `pnpm`, Node 22+
- Repo checked out and dependencies installed:

```bash
pnpm install
```

## 2) Deploy Enterprise Services to Local K8s

### 2.1 Create namespace and install Keycloak

```bash
kubectl apply -f deploy/k8s/local/namespace.yaml

helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm upgrade --install openclaw-keycloak bitnami/keycloak \
  --namespace openclaw-local \
  --create-namespace \
  -f deploy/k8s/local/keycloak-values.yaml
```

### 2.2 Build, load, and deploy all services

```bash
# identity
docker build -t openclaw/identity-service:local -f packages/identity-service/Dockerfile .
kind load docker-image openclaw/identity-service:local
kubectl apply -f deploy/k8s/local/identity-service.yaml

# tenant
docker build -t openclaw/tenant-service:local -f packages/tenant-service/Dockerfile .
kind load docker-image openclaw/tenant-service:local
kubectl apply -f deploy/k8s/local/tenant-service.yaml

# policy
docker build -t openclaw/policy-service:local -f packages/policy-service/Dockerfile .
kind load docker-image openclaw/policy-service:local
kubectl apply -f deploy/k8s/local/policy-service.yaml

# channel ingress
docker build -t openclaw/channel-ingress-service:local -f packages/channel-ingress-service/Dockerfile .
kind load docker-image openclaw/channel-ingress-service:local
kubectl apply -f deploy/k8s/local/channel-ingress-service.yaml

# orchestration
docker build -t openclaw/orchestration-service:local -f packages/orchestration-service/Dockerfile .
kind load docker-image openclaw/orchestration-service:local
kubectl apply -f deploy/k8s/local/orchestration-service.yaml

# skill control
docker build -t openclaw/skill-control-service:local -f packages/skill-control-service/Dockerfile .
kind load docker-image openclaw/skill-control-service:local
kubectl apply -f deploy/k8s/local/skill-control-service.yaml

# skill runtime
docker build -t openclaw/skill-runtime-service:local -f packages/skill-runtime-service/Dockerfile .
kind load docker-image openclaw/skill-runtime-service:local
kubectl apply -f deploy/k8s/local/skill-runtime-service.yaml

# conversation / provider proxy / audit
docker build -t openclaw/conversation-service:local -f packages/conversation-service/Dockerfile .
kind load docker-image openclaw/conversation-service:local
kubectl apply -f deploy/k8s/local/conversation-service.yaml
```

### 2.3 Verify rollout

```bash
kubectl -n openclaw-local get deploy
kubectl -n openclaw-local get pods
```

All deployments should be `READY 1/1`.

## 3) First User Signup + Login (Enterprise Identity)

In local enterprise setup, "signup" is usually done by tenant/admin creating a user in Keycloak.

### 3.1 Create realm/client/user in Keycloak

Option A (UI):

1. Port-forward Keycloak service.
2. Open Keycloak Admin UI.
3. Create realm `openclaw`.
4. Create OIDC client `openclaw-identity` with redirect URI:
   - `http://localhost:4001/v1/auth/callback`
5. Create user (example `alice`) and set password.

Option B (in-cluster CLI, matching milestone smoke):

```bash
kubectl -n openclaw-local exec <keycloak-pod> -- /bin/bash -lc '
/opt/keycloak/bin/kcadm.sh config credentials --server http://127.0.0.1:8080 --realm master --user admin --password admin
/opt/keycloak/bin/kcadm.sh create realms -s realm=openclaw -s enabled=true || true
/opt/keycloak/bin/kcadm.sh create clients -r openclaw -s clientId=openclaw-identity -s enabled=true -s protocol=openid-connect -s publicClient=false -s standardFlowEnabled=true -s directAccessGrantsEnabled=true -s secret=change-me -s "redirectUris=[\"http://localhost:4001/v1/auth/callback\"]" -s "webOrigins=[\"*\"]" || true
/opt/keycloak/bin/kcadm.sh create users -r openclaw -s username=alice -s enabled=true -s email=alice@example.com || true
/opt/keycloak/bin/kcadm.sh set-password -r openclaw --username alice --new-password alicepass
'
```

### 3.2 Login flow test

Port-forward Identity service:

```bash
kubectl -n openclaw-local port-forward svc/identity-service 4001:4001
```

Start login:

```bash
curl -sS -X POST http://127.0.0.1:4001/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"tenantHint":"tenant-a","redirectUri":"http://localhost:4001/v1/auth/callback"}'
```

Open returned `redirectUrl`, sign in as `alice`, then verify callback/refresh/logout endpoints succeed.

## 4) End-to-End Validation (Recommended)

### 4.1 Readiness gate (all services + audit integrity)

```bash
kubectl -n openclaw-local exec deployment/conversation-service-hostpath -- \
  node /workspace/scripts/enterprise-readiness-check.mjs
```

### 4.2 Resilience gate (restart + recovery)

```bash
node scripts/enterprise-resilience-check.mjs --targets orchestration-service,policy-service
```

### 4.3 CI artifact output (optional)

```bash
node scripts/enterprise-resilience-check.mjs \
  --targets orchestration-service,policy-service \
  --output /tmp/resilience-report.json

kubectl -n openclaw-local exec deployment/conversation-service-hostpath -- \
  node /workspace/scripts/enterprise-readiness-check.mjs --output /tmp/readiness-report.json
```

## 5) New User Onboarding to OpenClaw Enterprise UX

### 5.1 Gateway onboarding (recommended)

```bash
openclaw onboard
```

For browser UI (Control UI / Dashboard):

```bash
openclaw dashboard
```

### 5.2 Suggested first-run config goals

- set gateway auth token/password
- verify workspace path
- configure at least one channel account
- set DM policy (`pairing` or strict allowlist)
- install at least one skill

## 6) Connect Channels

## 6.1 WhatsApp

```bash
openclaw channels login --channel whatsapp
openclaw gateway
openclaw pairing list whatsapp
openclaw pairing approve whatsapp <CODE>
```

Recommended policy baseline:

```json5
{
  channels: {
    whatsapp: {
      dmPolicy: "pairing",
      allowFrom: ["+15551234567"],
      groupPolicy: "allowlist",
      groupAllowFrom: ["+15551234567"],
    },
  },
}
```

## 6.2 Telegram

1. Create bot with `@BotFather`.
2. Put token in config (`channels.telegram.botToken`) or env (`TELEGRAM_BOT_TOKEN`).
3. Start gateway and approve pairing.

```json5
{
  channels: {
    telegram: {
      enabled: true,
      botToken: "123:abc",
      dmPolicy: "pairing",
      groups: { "*": { requireMention: true } },
    },
  },
}
```

## 6.3 Slack (Socket Mode)

1. Create Slack app.
2. Enable Socket Mode.
3. Configure `appToken` (`xapp-...`) + `botToken` (`xoxb-...`).

```json5
{
  channels: {
    slack: {
      enabled: true,
      mode: "socket",
      appToken: "xapp-...",
      botToken: "xoxb-...",
    },
  },
}
```

Then run:

```bash
openclaw gateway
```

## 7) Use OpenClaw Through a Channel (User Journey)

After one channel is connected:

1. Send `hello` from your channel client.
2. If pairing is enabled, approve pairing code.
3. Send `/status`.
4. Send `/whoami`.
5. Send a normal task message (for example: "summarize today’s tasks").

This verifies inbound routing, auth policy, agent response, and outbound delivery.

## 8) Install and Configure Skills

## 8.1 Via UI (macOS app / Control surfaces)

- Open Skills view.
- Review missing requirements.
- Install a recommended installer option for each skill.
- Configure `enabled`, `apiKey`, and `env` values per skill.

Notes:

- UI writes to `skills.entries.*` in `~/.openclaw/openclaw.json`.
- Skills are gateway-backed; install/config actions happen on gateway host.

## 8.2 Via CLI (recommended for server workflows)

```bash
npm i -g clawhub
clawhub search "calendar"
clawhub install <skill-slug>
```

Then start a new session (or refresh skills) and invoke:

```text
/skill <name> [input]
```

## 8.3 Via channel client (for example WhatsApp)

From your owner/authorized chat:

1. Run skills by command:
   - `/skill <name> <input>`
2. If the skill is `user-invocable`, use its slash command directly where available.
3. For installation/config changes, prefer Control UI or CLI on host.

Advanced (optional): host shell from chat using `/bash` can install skills, but only if explicitly enabled and tightly allowlisted.

## 9) Troubleshooting Checklist

- `kubectl -n openclaw-local get pods` shows CrashLoopBackOff:
  - check logs: `kubectl -n openclaw-local logs deployment/<service> --tail=200`
- OIDC login fails:
  - confirm Keycloak realm/client redirect URI exactly matches Identity callback
- channel receives no replies:
  - run `openclaw channels status --probe`
  - confirm pairing/allowlists and token validity
- skill not available:
  - check `skills.entries.<skill>.enabled`
  - verify skill requirements (`bins`, `env`, config gates)

## 10) Minimal Acceptance Criteria (Post-Milestone)

- all services deployed in `openclaw-local`
- readiness gate returns `ok: true`
- resilience gate returns `ok: true`
- one user can login via OIDC
- one channel can receive and return messages
- one installed skill can be invoked from a channel using `/skill`
