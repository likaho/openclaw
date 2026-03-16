# Local Kubernetes Deployment

This directory contains manifests and values files for local testing with Keycloak, Identity service, Tenant service, Policy service, Channel Ingress service, Orchestration service, Skill Control service, Skill Runtime service, Onboarding service, and Enterprise Portal.

## Features

- **Idle-to-zero scaling**: All services scale to 0 replicas when idle for 60 seconds
- **Automatic scaling on demand**: Services scale up to 3 replicas when receiving traffic
- **Resource limits**: Each service has defined CPU and memory limits to prevent resource exhaustion
- **Health probes**: Readiness and liveness probes for reliable service health monitoring

## Prerequisites

- Local Kubernetes cluster (kind, minikube, or k3d)
- Helm installed
- **KEDA installed** (for idle-to-zero scaling):

  ```bash
  # Install KEDA using Helm
  helm repo add kedacore https://kedacore.github.io/charts
  helm repo update
  helm install keda kedacore/keda --namespace keda --create-namespace

  # Verify KEDA installation
  kubectl get pods -n keda
  ```

## Deployment Steps

### 1. Create the namespace:

```bash
kubectl apply -f deploy/k8s/local/namespace.yaml
```

### 2. Install KEDA ScaledObjects (optional - for idle-to-zero scaling):

If you want all services to scale to zero when idle, apply the KEDA configuration:

```bash
kubectl apply -f deploy/k8s/local/keda-config.yaml
```

**Note**: If you prefer to keep services always running (1 replica), skip this step.

### 3. Install Keycloak using the Bitnami chart:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm install openclaw-keycloak bitnami/keycloak \
  --namespace openclaw-local \
  --create-namespace \
  -f deploy/k8s/local/keycloak-values.yaml
```

### 4. Build and load local service images:

For each service, build the Docker image and load it into your cluster:

**Identity service:**

```bash
docker build -t openclaw/identity-service:latest -f packages/identity-service/Dockerfile .
kind load docker-image openclaw/identity-service:latest
```

**Tenant service:**

```bash
docker build -t openclaw/tenant-service:latest -f packages/tenant-service/Dockerfile .
kind load docker-image openclaw/tenant-service:latest
```

**Policy service:**

```bash
docker build -t openclaw/policy-service:latest -f packages/policy-service/Dockerfile .
kind load docker-image openclaw/policy-service:latest
```

**Channel Ingress service:**

```bash
docker build -t openclaw/channel-ingress-service:latest -f packages/channel-ingress-service/Dockerfile .
kind load docker-image openclaw/channel-ingress-service:latest
```

**Orchestration service:**

```bash
docker build -t openclaw/orchestration-service:latest -f packages/orchestration-service/Dockerfile .
kind load docker-image openclaw/orchestration-service:latest
```

**Skill Control service:**

```bash
docker build -t openclaw/skill-control-service:latest -f packages/skill-control-service/Dockerfile .
kind load docker-image openclaw/skill-control-service:latest
```

**Skill Runtime service:**

```bash
docker build -t openclaw/skill-runtime-service:latest -f packages/skill-runtime-service/Dockerfile .
kind load docker-image openclaw/skill-runtime-service:latest
```

**Conversation service:**

```bash
docker build -t openclaw/conversation-service:latest -f packages/conversation-service/Dockerfile .
kind load docker-image openclaw/conversation-service:latest
```

**Onboarding service:**

```bash
docker build -t openclaw/onboarding-service:latest -f packages/onboarding-service/Dockerfile .
kind load docker-image openclaw/onboarding-service:latest
```

### 5. Deploy all services:

```bash
kubectl apply -f deploy/k8s/local/identity-service.yaml
kubectl apply -f deploy/k8s/local/tenant-service.yaml
kubectl apply -f deploy/k8s/local/policy-service.yaml
kubectl apply -f deploy/k8s/local/channel-ingress-service.yaml
kubectl apply -f deploy/k8s/local/orchestration-service.yaml
kubectl apply -f deploy/k8s/local/skill-control-service.yaml
kubectl apply -f deploy/k8s/local/skill-runtime-service.yaml
kubectl apply -f deploy/k8s/local/conversation-service.yaml
kubectl apply -f deploy/k8s/local/onboarding-service.yaml
```

### 6. Deploy Enterprise Portal:

```bash
kubectl apply -f deploy/k8s/local/enterprise-portal-hostpath.yaml
kubectl -n openclaw-local rollout status deployment/enterprise-portal-hostpath --timeout=240s
kubectl -n openclaw-local port-forward svc/enterprise-portal-hostpath 18788:4020
```

## Port Forwarding for Testing

```bash
kubectl -n openclaw-local port-forward svc/identity-service 4001:4001
kubectl -n openclaw-local port-forward svc/tenant-service 4002:4002
kubectl -n openclaw-local port-forward svc/policy-service 4003:4003
kubectl -n openclaw-local port-forward svc/channel-ingress-service 4004:4004
kubectl -n openclaw-local port-forward svc/orchestration-service 4005:4005
kubectl -n openclaw-local port-forward svc/skill-control-service 4006:4006
kubectl -n openclaw-local port-forward svc/skill-runtime-service 4007:4007
kubectl -n openclaw-local port-forward svc/conversation-service 4008:4008
kubectl -n openclaw-local port-forward svc/onboarding-service 4010:4010
kubectl -n openclaw-local port-forward svc/enterprise-portal-hostpath 4020:4020
```

## Verifying Idle-to-Zero Scaling

1. Check that services are initially scaled to 0 replicas:

   ```bash
   kubectl get pods -n openclaw-local
   ```

2. Trigger scaling by accessing a service endpoint:

   ```bash
   curl http://localhost:4001/health
   ```

3. Watch the service scale up:

   ```bash
   kubectl get pods -n openclaw-local -w
   ```

4. After 60 seconds of no traffic, the service will scale back to 0.

## Managing KEDA ScaledObjects

**Scale a service to always run (1 replica):**

```bash
kubectl patch scaledobject <service-name>-scaledobject -n openclaw-local --type='json' -p='[{"op": "replace", "path": "/spec/minReplicaCount", "value": 1}]'
```

**Remove KEDA management for a service:**

```bash
kubectl delete scaledobject <service-name>-scaledobject -n openclaw-local
```

**Check ScaledObject status:**

```bash
kubectl get scaledobjects -n openclaw-local
kubectl describe scaledobject <service-name>-scaledobject -n openclaw-local
```

## Troubleshooting

**Check service logs:**

```bash
kubectl logs -n openclaw-local -l app=<service-name>
```

**Check KEDA metrics:**

```bash
kubectl get pods -n keda
kubectl logs -n keda -l app=keda-operator
```

**Force redeploy a service:**

```bash
kubectl rollout restart deployment/<service-name> -n openclaw-local
```
