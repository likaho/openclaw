# OpenClaw Microservices Deployment Guide

This guide covers the complete deployment process for OpenClaw microservices on Kubernetes.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Configuration](#configuration)
4. [Building Images](#building-images)
5. [Deployment](#deployment)
6. [Verification](#verification)
7. [Scaling](#scaling)
8. [Monitoring](#monitoring)
9. [Troubleshooting](#troubleshooting)
10. [Security](#security)

---

## Architecture Overview

### Service Components

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KUBERNETES CLUSTER                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    │
│  │   API Gateway    │    │   Control Plane  │    │   Agent Runtime  │    │
│  │   (Port 18789)  │    │   (Port 3000)    │    │   (Port 3000)   │    │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘    │
│           │                       │                       │                 │
│           └───────────────────────┼───────────────────────┘                 │
│                                   │                                          │
│                    ┌──────────────┴──────────────┐                         │
│                    │      Redis Message Queue     │                         │
│                    └──────────────┬──────────────┘                         │
│                                   │                                          │
│  ┌────────────┬────────────┬─────┴─────┬────────────┬────────────┐       │
│  │  Discord   │  Telegram  │   Slack   │ WhatsApp   │  [More]   │       │
│  │  Service   │  Service   │  Service  │  Service   │  Services │       │
│  └────────────┴────────────┴───────────┴────────────┴────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Service Definitions

| Service | Purpose | Ports | Replicas |
|---------|---------|-------|----------|
| **API Gateway** | HTTP/WebSocket entry point, auth | 18789, 18790 | 3 (HPA) |
| **Control Plane** | ACP protocol, session management | 3000 | 3 (HPA) |
| **Agent Runtime** | AI agent execution | 3000 | 3 (HPA) |
| **Plugin Registry** | Extension management | 3000 | 2 (static) |
| **Channel Services** | Per-channel messaging | 3000 | 2 each (HPA) |

---

## Prerequisites

### Infrastructure

- **Kubernetes**: v1.28 or higher
- **kubectl**: Configured with cluster access
- **Helm**: v3.10+
- **Docker**: For building images

### Required Components

- **Ingress Controller** (nginx-ingress or Istio)
- **Service Mesh** (optional, Istio recommended)
- **Prometheus** (for metrics)
- **Redis** (for message queue)

### Install Prerequisites

```bash
# Install kubectl
curl -LO "https://dl.k8s.io/release/$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl
sudo mv kubectl /usr/local/bin/

# Install Helm
curl -fsSL https://get.helm.sh/helm-v3.12.0-linux-amd64.tar.gz | tar -xz
sudo mv linux-amd64/helm /usr/local/bin/helm

# Verify installations
kubectl version --client
helm version
```

---

## Configuration

### Environment Variables

Create a `values.yaml` or use environment-specific overrides:

```yaml
# values-prod.yaml
global:
  imageRegistry: ghcr.io
  imagePullSecrets: ghcr
  domain: openclaw.example.com
  
apiGateway:
  replicaCount: 3
  autoscaling:
    enabled: true
    minReplicas: 3
    maxReplicas: 50
    
controlPlane:
  replicaCount: 3
  
redis:
  enabled: true
  url: "redis://redis-master:6379"
```

### Secrets Configuration

Create Kubernetes secrets for credentials:

```bash
# Create namespace
kubectl create namespace openclaw

# Create secret for channel credentials
kubectl create secret generic openclaw-secrets \
  --namespace openclaw \
  --from-literal=OPENCLAW_GATEWAY_TOKEN="$(openssl rand -hex 32)" \
  --from-literal=DISCORD_BOT_TOKEN="$DISCORD_BOT_TOKEN" \
  --from-literal=TELEGRAM_BOT_TOKEN="$TELEGRAM_BOT_TOKEN" \
  --from-literal=SLACK_BOT_TOKEN="$SLACK_BOT_TOKEN"

# Create image pull secret (for private registry)
kubectl create secret docker-registry ghcr \
  --docker-server=ghcr.io \
  --docker-username=$GITHUB_USERNAME \
  --docker-password=$GITHUB_TOKEN \
  --namespace openclaw
```

### Channel Service Credentials

Each channel service requires specific credentials:

```bash
# Discord
kubectl create secret generic discord-credentials \
  --from-literal=BOT_TOKEN=$DISCORD_BOT_TOKEN \
  --namespace openclaw-channels

# Telegram
kubectl create secret generic telegram-credentials \
  --from-literal=BOT_TOKEN=$TELEGRAM_BOT_TOKEN \
  --namespace openclaw-channels

# Slack
kubectl create secret generic slack-credentials \
  --from-literal=BOT_TOKEN=$SLACK_BOT_TOKEN \
  --from-literal=SIGNING_SECRET=$SLACK_SIGNING_SECRET \
  --namespace openclaw-channels

# WhatsApp (session data)
kubectl create secret generic whatsapp-credentials \
  --from-literal=SESSION_PATH=/app/whatsapp-sessions \
  --namespace openclaw-channels
```

---

## Building Images

### Build All Services

```bash
# Set registry
REGISTRY=ghcr.io/your-org
VERSION=v2026.2.26

# Build each service
for service in api-gateway control-plane channel-discord channel-telegram \
               channel-slack channel-whatsapp agent-runtime plugin-registry; do
  docker build -f docker/Dockerfile.${service} \
    -t ${REGISTRY}/openclaw-${service}:${VERSION} \
    -t ${REGISTRY}/openclaw-${service}:latest \
    .
done

# Push to registry
for service in api-gateway control-plane channel-discord channel-telegram \
               channel-slack channel-whatsapp agent-runtime plugin-registry; do
  docker push ${REGISTRY}/openclaw-${service}:${VERSION}
  docker push ${REGISTRY}/openclaw-${service}:latest
done
```

### Using GitHub Actions

The CI/CD pipeline automatically builds and pushes images on push to main:

```yaml
# .github/workflows/microservices.yaml (already configured)
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  docker-build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [api-gateway, control-plane, channel-discord, ...]
```

---

## Deployment

### Option 1: Using Helm

```bash
# Add Helm repository (if published)
helm repo add openclaw https://openclaw.github.io/helm-charts
helm repo update

# Install with default values
helm install openclaw ./helm/openclaw \
  --namespace openclaw \
  --create-namespace

# Install with custom values
helm install openclaw ./helm/openclaw \
  --namespace openclaw \
  --create-namespace \
  --values values-prod.yaml \
  --set global.imageRegistry=ghcr.io/your-org
```

### Option 2: Using Kustomize

```bash
# Deploy to development
kubectl apply -k k8s/environments/dev/

# Deploy to staging
kubectl apply -k k8s/environments/staging/

# Deploy to production
kubectl apply -k k8s/environments/prod/
```

### Option 3: Direct kubectl

```bash
# Apply base resources
kubectl apply -f k8s/base/00-namespace.yaml
kubectl apply -f k8s/base/01-configmap.yaml

# Apply secrets (edit first)
kubectl apply -f k8s/base/02-secrets.yaml

# Apply service accounts
kubectl apply -f k8s/base/40-service-accounts.yaml

# Apply services
kubectl apply -f k8s/base/10-api-gateway.yaml
kubectl apply -f k8s/base/11-control-plane.yaml

# Apply channel services
kubectl apply -f k8s/base/21-channel-discord.yaml
kubectl apply -f k8s/base/22-channel-telegram.yaml
kubectl apply -f k8s/base/23-channel-slack.yaml
kubectl apply -f k8s/base/24-channel-whatsapp.yaml

# Apply agent runtime
kubectl apply -f k8s/base/30-agent-runtime.yaml
```

---

## Deployment Order

Apply resources in this order:

1. **Namespaces** - `00-namespace.yaml`
2. **ConfigMaps** - `01-configmap.yaml`
3. **Secrets** - `02-secrets.yaml` (after editing)
4. **Service Accounts** - `40-service-accounts.yaml`
5. **Network Policies** - `50-network-policies.yaml`
6. **Deployments** - Start with API Gateway, then Control Plane, then others

---

## Verification

### Check Pod Status

```bash
# All namespaces
kubectl get pods -n openclaw
kubectl get pods -n openclaw-channels
kubectl get pods -n openclaw-system

# Watch status
kubectl get pods -n openclaw -w
```

### Check Services

```bash
# List services
kubectl get svc -n openclaw
kubectl get svc -n openclaw-channels
```

### Check HPA

```bash
# View autoscaling status
kubectl get hpa -n openclaw
kubectl get hpa -n openclaw-channels

# Detailed info
kubectl describe hpa api-gateway -n openclaw
```

### Test Health Endpoints

```bash
# Port forward to API Gateway
kubectl port-forward -n openclaw svc/api-gateway 18789:18789

# Test health
curl http://localhost:18789/health

# Test readiness
curl http://localhost:18789/ready

# Test metrics
curl http://localhost:18789/metrics
```

### Check Logs

```bash
# API Gateway logs
kubectl logs -n openclaw -l app=api-gateway --tail=100

# Follow logs
kubectl logs -n openclaw -l app=api-gateway -f

# Previous logs (if pod restarted)
kubectl logs -n openclaw -l app=api-gateway --previous --tail=100
```

---

## Scaling

### Horizontal Pod Autoscaling

All services are configured with HPA. Default settings:

```yaml
# Example HPA configuration
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
```

### Manual Scaling

```bash
# Scale API Gateway
kubectl scale deployment api-gateway --replicas=10 -n openclaw

# Scale channel service
kubectl scale deployment channel-discord --replicas=5 -n openclaw-channels
```

### Custom Metrics Scaling

For queue-based scaling, install Prometheus Adapter:

```bash
# Install Prometheus Adapter
helm install prometheus-adapter prometheus-community/prometheus-adapter \
  --namespace monitoring \
  --set prometheus.url=http://prometheus-server.monitoring
```

---

## Monitoring

### Prometheus Metrics

Each service exposes Prometheus metrics at `/metrics`:

```bash
# Access metrics endpoint
kubectl port-forward -n openclaw svc/api-gateway 9090:9090
curl http://localhost:9090/metrics

# Key metrics:
# - openclaw_service_info
# - openclaw_uptime_seconds
# - http_request_duration_seconds_bucket
# - http_requests_total
```

### Grafana Dashboards

Import the OpenClaw dashboard from `dashboards/openclaw.json`:

```bash
# Add Grafana datasource
kubectl create secret generic grafana-datasources \
  --from-file=datasources.yaml=dashboards/datasources.yaml \
  -n monitoring

# Import dashboard
kubectl apply -f dashboards/openclaw-dashboard.yaml -n monitoring
```

### Logging

```bash
# View structured logs
kubectl logs -n openclaw -l app=api-gateway --tail=100 -f | jq

# Query logs with labels
kubectl logs -n openclaw -l app=api-gateway,json=true
```

### Tracing

With Jaeger installed:

```bash
# Access Jaeger UI
kubectl port-forward -n monitoring svc/jaeger 16686:16686
# Open http://localhost:16686
```

---

## Troubleshooting

### Pod Not Starting

```bash
# Check events
kubectl describe pod <pod-name> -n openclaw

# Check logs
kubectl logs <pod-name> -n openclaw

# Common issues:
# - ImagePullBackOff: Check image registry credentials
# - CrashLoopBackOff: Check application logs
# - Pending: Check resource quotas or node capacity
```

### Service Not Reachable

```bash
# Check service endpoints
kubectl get endpoints -n openclaw

# Test connectivity
kubectl run test --rm -it --image=busybox --restart=Never -- \
  wget -qO- http://api-gateway:18789/health

# Check network policies
kubectl get networkpolicies -n openclaw
kubectl describe networkpolicy <policy-name> -n openclaw
```

### High Resource Usage

```bash
# Check resource usage
kubectl top pods -n openclaw

# Check node resources
kubectl describe nodes

# Review HPA
kubectl describe hpa <service-name> -n openclaw
```

### Database/Redis Connection Issues

```bash
# Check Redis status
kubectl get pods -n openclaw-system -l app=redis

# Test Redis connection
kubectl run redis-test --rm -it --image=redis --restart=Never -- \
  redis-cli -h redis-master.openclaw-system ping

# Check secrets
kubectl get secrets openclaw-secrets -n openclaw -o yaml
```

---

## Security

### Network Policies

Network policies restrict traffic between services:

```bash
# View network policies
kubectl get networkpolicies -n openclaw
kubectl get networkpolicies -n openclaw-channels

# Allow specific traffic (example)
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: allow-custom
  namespace: openclaw
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: ingress-nginx
EOF
```

### Pod Security

All pods run with:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  runAsGroup: 1000
  fsGroup: 1000
  allowPrivilegeEscalation: false
  readOnlyRootFilesystem: true
  capabilities:
    drop:
    - ALL
```

### Secret Management

For production, integrate with external secret managers:

```bash
# Install External Secrets Operator
helm install external-secrets \
  external-secrets/external-secrets \
  -n external-secrets \
  --create-namespace

# Create ClusterSecretStore
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: vault-backend
spec:
  provider:
    vault:
      server: "https://vault.example.com"
      path: "secret"
      version: "v2"
      auth:
        kubernetes:
          mountPath: /kubernetes
          role: openclaw
EOF
```

---

## Upgrading

### Helm Upgrade

```bash
# Upgrade deployment
helm upgrade openclaw ./helm/openclaw \
  --namespace openclaw \
  --values values-prod.yaml

# Rollback if needed
helm rollback openclaw 1 -n openclaw
```

### kubectl Apply

```bash
# Apply changes
kubectl apply -k k8s/environments/prod/

# View changes before applying
kubectl diff -k k8s/environments/prod/
```

### Rolling Updates

All deployments use RollingUpdate strategy:

```yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
```

---

## Backup and Recovery

### Session Data

Redis stores session data:

```bash
# Backup Redis
kubectl exec -n openclaw-system redis-master-0 -- redis-cli BGSAVE

# Copy dump file
kubectl cp openclaw-system/redis-master-0:/data/dump.rdb ./backup.rdb

# Restore
kubectl cp ./backup.rdb openclaw-system/redis-master-0:/data/dump.rdb
kubectl exec -n openclaw-system redis-master-0 -- redis-cli BGREWRITEAOF
```

### Configuration

ConfigMaps are versioned in git. Restore with:

```bash
kubectl apply -f k8s/base/01-configmap.yaml
```

---

## Production Checklist

- [ ] Kubernetes v1.28+
- [ ] Ingress controller configured
- [ ] TLS certificates (Let's Encrypt or custom)
- [ ] Secrets created with strong values
- [ ] Network policies applied
- [ ] Resource limits set
- [ ] HPA configured and tested
- [ ] Monitoring (Prometheus/Grafana) installed
- [ ] Logging (Loki) configured
- [ ] Backup strategy in place
- [ ] Disaster recovery plan documented

---

## Support

- **Issues**: https://github.com/openclaw/openclaw/issues
- **Documentation**: https://docs.openclaw.ai
- **Discord**: https://discord.gg/openclaw
