**Completed: Updated openclaw-local Kubernetes manifests with idle-to-zero scaling and upgrades**

## Changes Made

### 1. Created KEDA Configuration (`keda-config.yaml`)

- Added KEDA ScaledObjects for all 10 services
- Each service scales from 0 to 3 replicas based on HTTP traffic
- **60-second cooldown period** before scaling back to zero
- Requires KEDA operator to be installed in the cluster

### 2. Updated All Service Deployments

Updated the following files with:

- `replicas: 0` (starts scaled down)
- `image: openclaw/<service>:latest` (upgraded image tags)
- Resource requests/limits (64Mi-256Mi memory, 50m-500m CPU)
- Readiness and liveness probes for health monitoring

Files updated:

- `identity-service.yaml`
- `tenant-service.yaml`
- `policy-service.yaml`
- `channel-ingress-service.yaml`
- `orchestration-service.yaml`
- `skill-control-service.yaml`
- `skill-runtime-service.yaml`
- `conversation-service.yaml`
- `onboarding-service.yaml`
- `enterprise-portal-hostpath.yaml`

### 3. Updated README.md

- Added section explaining idle-to-zero scaling feature
- Updated build commands to use `:latest` tag
- Added instructions for installing KEDA
- Added troubleshooting section for KEDA ScaledObjects

## Prerequisites for Idle-to-Zero Scaling

1. Install KEDA operator:

   ```bash
   helm repo add kedacore https://kedacore.github.io/charts
   helm install keda kedacore/keda --namespace keda --create-namespace
   ```

2. Apply the KEDA configuration:
   ```bash
   kubectl apply -f deploy/k8s/local/keda-config.yaml
   ```

## Behavior

- **Idle state**: 0 replicas (no memory/CPU usage)
- **On traffic**: Automatically scales to 1 replica
- **After 60s idle**: Scales back to 0 replicas
- **Max replicas**: 3 per service under load
