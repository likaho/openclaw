# Local Kubernetes Deployment

This directory contains manifests and values files for local testing with Keycloak, Identity service, Tenant service, Policy service, Channel Ingress service, and Orchestration service.

## Prerequisites

- Local cluster (kind, minikube, or k3d)
- Helm installed

## Steps

1. Create the namespace:

```bash
kubectl apply -f deploy/k8s/local/namespace.yaml
```

2. Install Keycloak using the Bitnami chart:

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm repo update

helm install openclaw-keycloak bitnami/keycloak \
  --namespace openclaw-local \
  --create-namespace \
  -f deploy/k8s/local/keycloak-values.yaml
```

3. Build the Identity service image:

```bash
docker build -t openclaw/identity-service:local -f packages/identity-service/Dockerfile .
```

4. Load the image into your cluster if needed:

```bash
kind load docker-image openclaw/identity-service:local
```

5. Deploy the Identity service:

```bash
kubectl apply -f deploy/k8s/local/identity-service.yaml
```

6. Build and deploy the Tenant service:

```bash
docker build -t openclaw/tenant-service:local -f packages/tenant-service/Dockerfile .
kind load docker-image openclaw/tenant-service:local
kubectl apply -f deploy/k8s/local/tenant-service.yaml
```

7. Port forward for local testing:

```bash
kubectl -n openclaw-local port-forward svc/identity-service 4001:4001
kubectl -n openclaw-local port-forward svc/tenant-service 4002:4002
kubectl -n openclaw-local port-forward svc/policy-service 4003:4003
kubectl -n openclaw-local port-forward svc/channel-ingress-service 4004:4004
kubectl -n openclaw-local port-forward svc/orchestration-service 4005:4005
```

8. Build and deploy the Policy service:

```bash
docker build -t openclaw/policy-service:local -f packages/policy-service/Dockerfile .
kind load docker-image openclaw/policy-service:local
kubectl apply -f deploy/k8s/local/policy-service.yaml
```

9. Build and deploy the Channel Ingress service:

```bash
docker build -t openclaw/channel-ingress-service:local -f packages/channel-ingress-service/Dockerfile .
kind load docker-image openclaw/channel-ingress-service:local
kubectl apply -f deploy/k8s/local/channel-ingress-service.yaml
```

10. Build and deploy the Orchestration service:

```bash
docker build -t openclaw/orchestration-service:local -f packages/orchestration-service/Dockerfile .
kind load docker-image openclaw/orchestration-service:local
kubectl apply -f deploy/k8s/local/orchestration-service.yaml
```
