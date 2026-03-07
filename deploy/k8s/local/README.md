# Local Kubernetes Deployment

This directory contains manifests and values files for local testing with Keycloak, Identity service, Tenant service, Policy service, Channel Ingress service, Orchestration service, Skill Control service, Skill Runtime service, Onboarding service, and Enterprise Portal.

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
kubectl -n openclaw-local port-forward svc/skill-control-service 4006:4006
kubectl -n openclaw-local port-forward svc/skill-runtime-service 4007:4007
kubectl -n openclaw-local port-forward svc/conversation-service 4008:4008
kubectl -n openclaw-local port-forward svc/onboarding-service 4010:4010
kubectl -n openclaw-local port-forward svc/enterprise-portal 4020:4020
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

11. Build and deploy the Skill Control service:

```bash
docker build -t openclaw/skill-control-service:local -f packages/skill-control-service/Dockerfile .
kind load docker-image openclaw/skill-control-service:local
kubectl apply -f deploy/k8s/local/skill-control-service.yaml
```

12. Build and deploy the Skill Runtime service:

```bash
docker build -t openclaw/skill-runtime-service:local -f packages/skill-runtime-service/Dockerfile .
kind load docker-image openclaw/skill-runtime-service:local
kubectl apply -f deploy/k8s/local/skill-runtime-service.yaml
```

13. Build and deploy the Conversation service:

```bash
docker build -t openclaw/conversation-service:local -f packages/conversation-service/Dockerfile .
kind load docker-image openclaw/conversation-service:local
kubectl apply -f deploy/k8s/local/conversation-service.yaml
```

14. Build and deploy the Onboarding service:

```bash
docker build -t openclaw/onboarding-service:local -f packages/onboarding-service/Dockerfile .
kind load docker-image openclaw/onboarding-service:local
kubectl apply -f deploy/k8s/local/onboarding-service.yaml
```

15. Build and deploy the Enterprise Portal:

```bash
docker build -t openclaw/enterprise-portal:local -f packages/enterprise-portal/Dockerfile .
kind load docker-image openclaw/enterprise-portal:local
kubectl apply -f deploy/k8s/local/enterprise-portal.yaml
```

16. Deploy Enterprise Portal using kubectl-only hostPath mode (for non-kind local clusters):

```bash
kubectl apply -f deploy/k8s/local/enterprise-portal-hostpath.yaml
kubectl -n openclaw-local rollout status deployment/enterprise-portal-hostpath --timeout=240s
kubectl -n openclaw-local port-forward svc/enterprise-portal-hostpath 18788:4020
```

Open `http://localhost:18788/` for the browser onboarding portal.
