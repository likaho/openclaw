# OpenClaw Kubernetes Deployment Guide

This guide covers deploying OpenClaw microservices to Kubernetes.

## Prerequisites

- Kubernetes 1.28+ cluster
- Helm 3.10+
- kubectl configured
- Container registry access (Docker Hub, GCR, ECR, etc.)

## Quick Start

### 1. Build Docker Images

```bash
# Build all service images
cd services

# Build each service
for svc in api-gateway control-plane session-manager agent-runtime \
            channel-discord channel-telegram channel-slack channel-whatsapp; do
  docker build -t openclaw/$svc:2026.2.26 $svc/
done

# Push to registry (example with Docker Hub)
for svc in api-gateway control-plane session-manager agent-runtime \
            channel-discord channel-telegram channel-slack channel-whatsapp; do
  docker push openclaw/$svc:2026.2.26
done
```

### 2. Install Helm Chart

```bash
# Add dependencies
cd services/k8s/charts/openclaw
helm dependency build

# Install with defaults
helm install openclaw . -n openclaw --create-namespace

# Or with custom values
helm install openclaw . -n openclaw -f values.yaml
```

### 3. Verify Deployment

```bash
# Check pods
kubectl get pods -n openclaw

# Check services
kubectl get svc -n openclaw

# View logs
kubectl logs -n openclaw -l app=api-gateway
```

## Configuration

### Required Secrets

Create secrets before deployment:

```bash
# Redis password
kubectl create secret generic redis-credentials \
  --from-literal=redis-password=your-redis-password \
  -n openclaw

# API keys (per channel)
kubectl create secret generic channel-credentials \
  --from-literal=discord-bot-token=DISCORD_TOKEN \
  --from-literal=telegram-bot-token=TELEGRAM_TOKEN \
  --from-literal=slack-bot-token=SLACK_TOKEN \
  --from-literal=whatsapp-access-token=WHATSAPP_TOKEN \
  -n openclaw

# JWT secret
kubectl create secret generic api-gateway-secrets \
  --from-literal=jwt-secret=your-jwt-secret \
  -n openclaw
```

### Environment-Specific Values

Create `values-prod.yaml`:

```yaml
global:
  imageRegistry: your-registry.io/openclaw
  env:
    LOG_LEVEL: warn
    NODE_ENV: production

apiGateway:
  replicaCount: 3
  autoscaling:
    maxReplicas: 20

channels:
  discord:
    replicaCount: 5
```

Deploy:

```bash
helm upgrade openclaw . -f values.yaml -f values-prod.yaml -n openclaw
```

## Autoscaling

HPA is enabled by default. Configure based on your workload:

```bash
# View HPA status
kubectl get hpa -n openclaw

# Manual scale
kubectl scale deployment api-gateway --replicas=5 -n openclaw
```

## Monitoring

### Prometheus Metrics

Each service exposes `/metrics` endpoint:

```bash
# Access Prometheus
kubectl port-forward -n openclaw svc/prometheus 9090:9090

# Query example
kubectl exec -it -n openclaw \
  $(kubectl get pod -l app=api-gateway -n openclaw -o jsonpath='{.items[0].metadata.name}') \
  -- curl localhost:3000/metrics
```

### Logging

```bash
# View all logs
kubectl logs -n openclaw -l app.kubernetes.io/part-of=openclaw --tail=100

# Follow specific service
kubectl logs -n openclaw -f -l app=discord-channel
```

## Troubleshooting

### Pod Not Starting

```bash
# Check events
kubectl describe pod <pod-name> -n openclaw

# Check logs
kubectl logs <pod-name> -n openclaw
```

### Service Not Reachable

```bash
# Check service endpoints
kubectl get endpoints -n openclaw

# Test connectivity
kubectl run test --rm -it --image=busybox --restart=Never -- \
  wget -qO- http://api-gateway:3000/health
```

### High Memory/CPU

```bash
# Check resource usage
kubectl top pods -n openclaw

# Adjust resources in values.yaml and upgrade
helm upgrade openclaw . -n openclaw
```

## Scaling Considerations

| Service | Scaling Trigger | Max Replicas |
|---------|-----------------|--------------|
| api-gateway | Request rate, CPU | 10 |
| control-plane | Active sessions | 8 |
| session-manager | Session count | 5 |
| agent-runtime | Message queue depth | 20 |
| channel-discord | Message volume | 10 |
| channel-telegram | Message volume | 10 |
| channel-slack | Message volume | 10 |
| channel-whatsapp | Message volume | 10 |

## Production Checklist

- [ ] Enable TLS/SSL
- [ ] Configure resource limits
- [ ] Set up alerting
- [ ] Enable backup for Redis
- [ ] Configure Kafka replication
- [ ] Set up log aggregation
- [ ] Configure network policies
- [ ] Enable pod disruption budgets
- [ ] Set up horizontal pod autoscaling
- [ ] Configure secret management (Vault/ESO)
