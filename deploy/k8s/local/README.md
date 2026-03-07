# Local Kubernetes Deployment

This directory contains manifests and values files for local testing with Keycloak and the Identity service.

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

6. Port forward for local testing:

```bash
kubectl -n openclaw-local port-forward svc/identity-service 4001:4001
```
