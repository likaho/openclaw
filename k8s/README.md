# OpenClaw Microservices - Quick Start Guide

This guide helps you deploy OpenClaw microservices to a production Kubernetes cluster.

## Prerequisites

- Kubernetes cluster (v1.28+)
- kubectl configured
- Helm 3.x
- Docker for building images
- Optional: Istio for service mesh

## Quick Start

### 1. Build Docker Images

```bash
# Build all microservices
cd docker

# Build each service
docker build -f Dockerfile.api-gateway -t openclaw/api-gateway:latest ../.
docker build -f Dockerfile.control-plane -t openclaw/control-plane:latest ../.
docker build -f Dockerfile.channel-discord -t openclaw/channel-discord:latest ../.
docker build -f Dockerfile.channel-telegram -t openclaw/channel-telegram:latest ../.
docker build -f Dockerfile.channel-slack -t openclaw/channel-slack:latest ../.
docker build -f Dockerfile.channel-whatsapp -t openclaw/channel-whatsapp:latest ../.
docker build -f Dockerfile.agent-runtime -t openclaw/agent-runtime:latest ../.
docker build -f Dockerfile.plugin-registry -t openclaw/plugin-registry:latest ../.

# Push to registry
docker push openclaw/api-gateway:latest
# ... repeat for other services
```

### 2. Deploy to Kubernetes

```bash
# Option A: Using Kustomize
cd k8s/environments/dev
kubectl apply -k .

# Option B: Using Helm
helm install openclaw ./helm/openclaw -n openclaw --create-namespace
```

### 3. Verify Deployment

```bash
# Check pods
kubectl get pods -n openclaw
kubectl get pods -n openclaw-channels

# Check services
kubectl get svc -n openclaw

# Check HPA
kubectl get hpa -n openclaw
```

## Deployment Environments

| Environment | Command | Description |
|-------------|---------|-------------|
| Dev | `kubectl apply -k k8s/environments/dev` | Development, single replicas |
| Staging | `kubectl apply -k k8s/environments/staging` | Pre-production testing |
| Prod | `kubectl apply -k k8s/environments/prod` | Production with HPA |

## Service Architecture

```
                           ┌─────────────────┐
                           │   Ingress/Nginx │
                           └────────┬────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────┐
                    │      API Gateway Service     │
                    │         (Port 18789)         │
                    └─────────────┬───────────────┘
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼             ▼
         ┌──────────────┐ ┌─────────────┐ ┌──────────────┐
         │Control Plane │ │Agent Runtime│ │Plugin Registry│
         │    (ACP)     │ │             │ │              │
         └──────┬───────┘ └──────┬──────┘ └──────────────┘
                │                 │
                │    Redis Message Queue
                ▼                 ▼
┌──────────────────────────────────────────────────────────┐
│                    Channel Services                       │
├──────────┬──────────┬──────────┬──────────┬─────────────┤
│ Discord  │ Telegram │  Slack   │WhatsApp  │   ...more   │
└──────────┴──────────┴──────────┴──────────┴─────────────┘
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `REDIS_URL` | Redis connection | `redis://redis-master:6379` |
| `CONTROL_PLANE_URL` | ACP Server URL | `http://control-plane:3000` |
| `LOG_LEVEL` | Logging level | `info` |
| `NODE_ENV` | Environment | `production` |

### Secrets

Create secrets before deployment:

```bash
# Create secret for channel credentials
kubectl create secret generic channel-credentials \
  --from-literal=DISCORD_BOT_TOKEN=your_token \
  --from-literal=TELEGRAM_BOT_TOKEN=your_token \
  -n openclaw-channels
```

## Autoscaling

All services are configured with HPA:

```bash
# View HPA status
kubectl get hpa -n openclaw

# Manual scale
kubectl scale deployment api-gateway --replicas=5 -n openclaw
```

## Monitoring

### Prometheus Metrics

Each service exposes metrics at `/metrics`:

```bash
# Access metrics
kubectl port-forward -n openclaw svc/api-gateway 9090:9090
curl http://localhost:9090/metrics
```

### Logs

```bash
# View logs
kubectl logs -n openclaw -l app=api-gateway --tail=100

# Follow logs
kubectl logs -n openclaw -l app=api-gateway -f
```

### Tracing

With Jaeger:

```bash
# Access Jaeger UI
kubectl port-forward -n openclaw-monitoring svc/jaeger 16686:16686
# Open http://localhost:16686
```

## Troubleshooting

### Pod not starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n openclaw

# Check logs
kubectl logs <pod-name> -n openclaw
```

### Service not reachable

```bash
# Check service endpoints
kubectl get endpoints -n openclaw

# Test connectivity
kubectl run test --rm -it --image=busybox --restart=Never -- \
  wget -qO- http://api-gateway:18789/health
```

### High memory/CPU

```bash
# Check resource usage
kubectl top pods -n openclaw

# Check HPA status
kubectl describe hpa <service-name> -n openclaw
```

## Adding New Channel Services

1. Create Dockerfile in `docker/`
2. Create K8s manifest in `k8s/base/`
3. Add to CI/CD workflow
4. Configure credentials

## Security

- All pods run as non-root (UID 1000)
- Network policies restrict traffic between services
- mTLS enabled via Istio (optional)
- Secrets stored in Kubernetes Secrets or external vault

## Backup and Recovery

- Redis data persisted via PVC
- Session data in Redis
- Config in ConfigMaps

For disaster recovery:
1. Restore Redis from backup
2. Reapply ConfigMaps
3. Restart deployments
