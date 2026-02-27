# OpenClaw Microservices Configuration Guide

This document details all configuration options for OpenClaw microservices.

## Table of Contents

1. [Environment Variables](#environment-variables)
2. [Configuration Files](#configuration-files)
3. [Service-Specific Settings](#service-specific-settings)
4. [Channel Credentials](#channel-credentials)
5. [Provider API Keys](#provider-api-keys)
6. [Feature Flags](#feature-flags)

---

## Environment Variables

### Global Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `NODE_ENV` | Environment mode | `production` | Yes |
| `SERVICE_NAME` | Service identifier | - | Yes |
| `LOG_LEVEL` | Logging verbosity | `info` | No |
| `LOG_FORMAT` | Log output format | `json` | No |
| `POD_NAME` | Pod name (auto) | - | Auto |
| `POD_NAMESPACE` | Pod namespace (auto) | - | Auto |

### Redis Configuration

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | Yes |
| `REDIS_PASSWORD` | Redis password | - | No |
| `REDIS_DB` | Redis database number | `0` | No |

### Service URLs

| Variable | Description | Default |
|----------|-------------|---------|
| `API_GATEWAY_URL` | API Gateway endpoint | `http://api-gateway:18789` |
| `CONTROL_PLANE_URL` | Control Plane endpoint | `http://control-plane:3000` |
| `AGENT_RUNTIME_URL` | Agent Runtime endpoint | `http://agent-runtime:3000` |
| `PLUGIN_REGISTRY_URL` | Plugin Registry endpoint | `http://plugin-registry:3000` |

### Message Queue

| Variable | Description | Default |
|----------|-------------|---------|
| `MESSAGE_QUEUE_URL` | Redis message queue | `redis://localhost:6379` |
| `QUEUE_PREFIX` | Queue name prefix | `openclaw` |

---

## Configuration Files

### ConfigMap Structure

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: openclaw-config
  namespace: openclaw
data:
  # Service URLs
  API_GATEWAY_URL: "http://api-gateway.openclaw:18789"
  CONTROL_PLANE_URL: "http://control-plane.openclaw:3000"
  AGENT_RUNTIME_URL: "http://agent-runtime.openclaw:3000"
  
  # Redis
  REDIS_URL: "redis://redis-master.openclaw-system:6379"
  
  # Features
  ENABLE_TRACING: "true"
  ENABLE_METRICS: "true"
  ENABLE_RATE_LIMITING: "true"
  
  # Logging
  LOG_LEVEL: "info"
  LOG_FORMAT: "json"
```

### Secrets Structure

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: openclaw-secrets
  namespace: openclaw
type: Opaque
stringData:
  # Gateway
  OPENCLAW_GATEWAY_TOKEN: "your-gateway-token"
  
  # Provider APIs
  ANTHROPIC_API_KEY: "sk-ant-..."
  OPENAI_API_KEY: "sk-..."
  GOOGLE_AI_API_KEY: "your-key"
  
  # Channel credentials (see Channel Credentials section)
```

---

## Service-Specific Settings

### API Gateway

```yaml
# Environment variables
env:
- name: PORT
  value: "18789"
- name: WS_PORT
  value: "18790"
- name: RATE_LIMIT_REQUESTS
  value: "100"
- name: RATE_LIMIT_WINDOW
  value: "60"  # seconds
- name: MAX_CONNECTIONS
  value: "1000"
- name: TIMEOUT
  value: "30000"  # milliseconds
```

### Control Plane (ACP)

```yaml
env:
- name: PORT
  value: "3000"
- name: SESSION_TTL
  value: "3600"  # seconds
- name: MAX_SESSIONS
  value: "10000"
- name: MESSAGE_TIMEOUT
  value: "60000"  # milliseconds
```

### Agent Runtime

```yaml
env:
- name: PORT
  value: "3000"
- name: MAX_CONCURRENT_TASKS
  value: "10"
- name: TASK_TIMEOUT
  value: "300000"  # 5 minutes
- name: WORKSPACE_PATH
  value: "/workspace"
- name: DEFAULT_MODEL
  value: "claude-3-opus"
```

### Channel Services

```yaml
env:
- name: CHANNEL_TYPE
  value: "DISCORD"  # TELEGRAM, SLACK, WHATSAPP, etc.
- name: MESSAGE_QUEUE
  value: "discord:inbound"
- name: POLL_INTERVAL
  value: "1000"  # milliseconds
- name: BATCH_SIZE
  value: "10"
```

---

## Channel Credentials

### Discord

```yaml
env:
- name: DISCORD_BOT_TOKEN
  valueFrom:
    secretKeyRef:
      name: discord-credentials
      key: bot-token
```

### Telegram

```yaml
env:
- name: TELEGRAM_BOT_TOKEN
  valueFrom:
    secretKeyRef:
      name: telegram-credentials
      key: bot-token
- name: TELEGRAM_API_ID
  valueFrom:
    secretKeyRef:
      name: telegram-credentials
      key: api-id
- name: TELEGRAM_API_HASH
  valueFrom:
    secretKeyRef:
      name: telegram-credentials
      key: api-hash
```

### Slack

```yaml
env:
- name: SLACK_BOT_TOKEN
  valueFrom:
    secretKeyRef:
      name: slack-credentials
      key: bot-token
- name: SLACK_SIGNING_SECRET
  valueFrom:
    secretKeyRef:
      name: slack-credentials
      key: signing-secret
- name: SLACK_APP_TOKEN
  valueFrom:
    secretKeyRef:
      name: slack-credentials
      key: app-token
```

### WhatsApp

```yaml
env:
- name: WHATSAPP_SESSION_PATH
  value: "/app/whatsapp-sessions"
- name: WHATSAPP_DEVICE_NAME
  value: "OpenClaw"
```

### Signal

```yaml
env:
- name: SIGNAL_USERNAME
  valueFrom:
    secretKeyRef:
      name: signal-credentials
      key: username
- name: SIGNAL_PASSWORD
  valueFrom:
    secretKeyRef:
      name: signal-credentials
      key: password
- name: SIGNAL_DEVICE_NAME
  value: "OpenClaw"
```

---

## Provider API Keys

### Anthropic (Claude)

```yaml
env:
- name: ANTHROPIC_API_KEY
  valueFrom:
    secretKeyRef:
      name: openclaw-secrets
      key: anthropic-api-key
- name: ANTHROPIC_BASE_URL
  value: "https://api.anthropic.com"
- name: ANTHROPIC_MAX_TOKENS
  value: "4096"
```

### OpenAI

```yaml
env:
- name: OPENAI_API_KEY
  valueFrom:
    secretKeyRef:
      name: openclaw-secrets
      key: openai-api-key
- name: OPENAI_BASE_URL
  value: "https://api.openai.com/v1"
- name: OPENAI_DEFAULT_MODEL
  value: "gpt-4"
```

### Google Gemini

```yaml
env:
- name: GOOGLE_AI_API_KEY
  valueFrom:
    secretKeyRef:
      name: openclaw-secrets
      key: google-ai-api-key
- name: GOOGLE_AI_MODEL
  value: "gemini-pro"
```

### AWS Bedrock

```yaml
env:
- name: AWS_ACCESS_KEY_ID
  valueFrom:
    secretKeyRef:
      name: openclaw-secrets
      key: aws-access-key-id
- name: AWS_SECRET_ACCESS_KEY
  valueFrom:
    secretKeyRef:
      name: openclaw-secrets
      key: aws-secret-access-key
- name: AWS_REGION
  value: "us-east-1"
- name: AWS_BEDROCK_MODEL
  value: "anthropic.claude-3-sonnet"
```

---

## Feature Flags

| Flag | Description | Default |
|------|-------------|---------|
| `ENABLE_TRACING` | Enable distributed tracing | `true` |
| `ENABLE_METRICS` | Enable Prometheus metrics | `true` |
| `ENABLE_RATE_LIMITING` | Enable rate limiting | `true` |
| `ENABLE_CIRCUIT_BREAKER` | Enable circuit breaker | `true` |
| `ENABLE_CACHE` | Enable response caching | `true` |
| `ENABLE_AUTH` | Enable authentication | `true` |
| `ENABLE_TLS` | Enable TLS | `false` |

---

## Resource Limits

### Recommended Resource Settings

| Service | CPU Request | CPU Limit | Memory Request | Memory Limit |
|---------|-------------|-----------|----------------|--------------|
| API Gateway | 250m | 1000m | 512Mi | 1Gi |
| Control Plane | 250m | 1000m | 512Mi | 1Gi |
| Agent Runtime | 500m | 2000m | 1Gi | 2Gi |
| Channel (small) | 100m | 500m | 256Mi | 512Mi |
| Channel (WhatsApp) | 250m | 1000m | 512Mi | 1Gi |
| Plugin Registry | 100m | 500m | 256Mi | 512Mi |
| Redis | 100m | 500m | 256Mi | 2Gi |

---

## Health Checks

### Liveness Probe

```yaml
livenessProbe:
  httpGet:
    path: /health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10
  timeoutSeconds: 5
  failureThreshold: 3
```

### Readiness Probe

```yaml
readinessProbe:
  httpGet:
    path: /ready
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 5
  timeoutSeconds: 3
  failureThreshold: 3
```

---

## Autoscaling Configuration

### HPA with CPU/Memory

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 50
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
      - type: Percent
        value: 100
        periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
```

---

## Environment Examples

### Development

```bash
# .env.dev
NODE_ENV=development
LOG_LEVEL=debug
REDIS_URL=redis://localhost:6379
ENABLE_TRACING=true
ENABLE_RATE_LIMITING=false
```

### Staging

```bash
# .env.staging
NODE_ENV=staging
LOG_LEVEL=info
REDIS_URL=redis://redis-staging:6379
ENABLE_TRACING=true
ENABLE_RATE_LIMITING=true
```

### Production

```bash
# .env.prod
NODE_ENV=production
LOG_LEVEL=warn
REDIS_URL=redis://redis-prod:6379
ENABLE_TRACING=true
ENABLE_RATE_LIMITING=true
ENABLE_TLS=true
```

---

## Configuration Management

### Using Helm Values

```yaml
# values-prod.yaml
apiGateway:
  replicaCount: 3
  env:
    LOG_LEVEL: warn
    RATE_LIMIT_REQUESTS: "100"
  resources:
    requests:
      cpu: 500m
      memory: 1Gi
    limits:
      cpu: 2000m
      memory: 2Gi
```

### Using Kustomize

```yaml
# kustomization.yaml
configMapGenerator:
- name: openclaw-config
  literals:
  - LOG_LEVEL=debug
  - REDIS_URL=redis://custom:6379
```

---

## Secrets Management

### Creating Secrets

```bash
# Using kubectl
kubectl create secret generic openclaw-secrets \
  --from-literal=OPENCLAW_GATEWAY_TOKEN=token123 \
  --from-literal=ANTHROPIC_API_KEY=key123 \
  --namespace openclaw

# Using sealed secrets (recommended for production)
kubeseal -n openclaw --controller-name=sealed-secrets \
  --controller-namespace=sealed-secrets \
  -f secrets.yaml
```

### External Secrets Operator

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: openclaw-secrets
spec:
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: openclaw-secrets
  data:
  - secretKey: anthropic-api-key
    remoteRef:
      key: openclaw/providers
      property: anthropic-api-key
```
