# OpenClaw Microservices Architecture for Kubernetes

This document outlines a comprehensive strategy to decouple OpenClaw into microservices suitable for enterprise Kubernetes deployment with autoscaling, testing, and observability.

---

## Executive Summary

OpenClaw is currently a **monolithic TypeScript/Node.js application** that combines:
- Multi-channel messaging gateway (Telegram, Discord, Slack, WhatsApp, Signal, etc.)
- AI agent runtime with ACP protocol
- CLI and TUI interfaces
- Plugin/extension system
- Infrastructure utilities (executions, heartbeats, device pairing)

This architecture presents challenges for:
- Independent scaling of high-traffic channels
- Fault isolation (channel outage doesn't crash gateway)
- Independent deployments of new channel integrations
- Team ownership boundaries
- Enterprise compliance and security requirements

---

## Proposed Microservices Architecture

### Service Boundaries

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            KUBERNETES CLUSTER                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐   │
│  │   API Gateway    │    │   Control Plane  │    │   Session Mgr    │   │
│  │   (Ingress)      │    │   (ACP Server)   │    │   (Stateful)     │   │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘   │
│           │                       │                       │              │
│           └───────────────────────┼───────────────────────┘              │
│                                   │                                          │
│           ┌───────────────────────┴───────────────────────┐              │
│           │              SERVICE MESH (Istio/Linkerd)      │              │
│           └───────────────────────┬───────────────────────┘              │
│                                   │                                          │
│  ┌────────────────────────────────┼────────────────────────────────┐      │
│  │                        SERVICE DISCOVERY                         │      │
│  │                              (CoreDNS)                           │      │
│  └────────────────────────────────┼────────────────────────────────┘      │
│                                   │                                          │
│  ┌─────────────┐  ┌─────────────┐│┌─────────────┐  ┌─────────────┐    │
│  │  Discord    │  │  Telegram   │││  Slack      │  │  WhatsApp   │    │
│  │  Service    │  │  Service     │││  Service    │  │  Service    │    │
│  └─────────────┘  └─────────────┘│└─────────────┘  └─────────────┘    │
│                                    │                                        │
│  ┌─────────────┐  ┌─────────────┐ │┌─────────────┐  ┌─────────────┐    │
│  │  Signal     │  │  iMessage   │ ││  Web/Chat   │  │  [Ext]      │    │
│  │  Service    │  │  Service    │ ││  Service    │  │  Service    │    │
│  └─────────────┘  └─────────────┘ │└─────────────┘  └─────────────┘    │
│                                    │                                        │
│  ┌────────────────────────────────┴────────────────────────────────┐     │
│  │                      AGENT RUNTIME SERVICE                        │     │
│  │              (Stateless - HPA by message count)                  │     │
│  └────────────────────────────────┬────────────────────────────────┘     │
│                                   │                                          │
│  ┌────────────────────────────────┴────────────────────────────────┐     │
│  │                      PLUGIN REGISTRY SERVICE                      │     │
│  │              (Manages extension lifecycle)                        │     │
│  └────────────────────────────────┬────────────────────────────────┘     │
│                                   │                                          │
│  ┌────────────────────────────┐   │   ┌────────────────────────────┐   │
│  │    PERSISTENT STORAGE      │   │   │    OBSERVABILITY           │   │
│  │  ┌─────────┐ ┌─────────┐  │   │   │  ┌────────┐ ┌────────┐    │   │
│  │  │Sessions │ │ Config  │  │   │   │  │ Prometheus│ │ Loki │    │   │
│  │  │(Redis)  │ │ (etcd)  │  │   │   │  │          │ │      │    │   │
│  │  └─────────┘ └─────────┘  │   │   │  └────────┘ └────────┘    │   │
│  └────────────────────────────┘   │   └────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Service Definitions

### 1. API Gateway Service
**Purpose**: Entry point for all client connections, routing, rate limiting, authentication

**Responsibilities**:
- HTTP/WebSocket endpoint management
- Request routing to appropriate services
- Authentication and authorization
- Rate limiting per channel/user
- TLS termination

**Technology**: Express.js (existing) or KrakenD/Nginx Ingress

**Scaling**: HPA based on request rate, CPU

**K8s Resources**:
```yaml
Deployment: api-gateway
Service: ClusterIP (internal), LoadBalancer (external)
HorizontalPodAutoscaler: CPU > 70% or RPS > 1000
```

---

### 2. Control Plane Service (ACP Server)
**Purpose**: Agent Communication Protocol server, session coordination

**Responsibilities**:
- ACP protocol implementation
- Session lifecycle management
- Message routing between channels and agents
- State synchronization

**Technology**: Express.js + WebSocket (existing gateway logic)

**Dependencies**: Redis (sessions), etcd (config)

**Scaling**: HPA based on active sessions

---

### 3. Session Manager Service
**Purpose**: Persistent session state, conversation history

**Responsibilities**:
- Session storage and retrieval
- Conversation history management
- Session persistence across restarts

**Technology**: Redis Cluster or PostgreSQL

**Stateful**: Yes (persistent data)

---

### 4. Channel Services (Per-Channel Microservices)

Each messaging channel becomes an independent service:

#### Discord Service
```
src/discord/ → discord-service/
├── Dockerfile
├── k8s/
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── hpa.yaml
│   └── configmap.yaml
└── tests/
```

**Specific Configuration**:
```yaml
# Discord-specific HPA - scale on message queue depth
metrics:
  - type: Redis
    redis:
      address: redis:6379
      queue: discord:inbound
```

#### Telegram Service
- Long-polling or Webhook mode
- Bot token management per instance

#### Slack Service
- Event subscription handling
- OAuth flow management

#### WhatsApp/Web Service
- Session persistence (Baileys)
- QR code generation/validation

**Common Channel Service Interface**:
```typescript
interface ChannelService {
  // Inbound
  onMessage(handler: MessageHandler): void;
  onCallbackQuery(handler: CallbackQueryHandler): void;
  
  // Outbound
  sendMessage(target: string, message: Message): Promise<void>;
  sendMedia(target: string, media: Media): Promise<void>;
  
  // Lifecycle
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  getStatus(): ChannelStatus;
}
```

---

### 5. Agent Runtime Service
**Purpose**: Execute AI agent tasks, tool invocations

**Responsibilities**:
- Agent state machine execution
- Tool execution (bash, file operations, browser)
- Model API calls
- Session context management

**Scaling**: HPA based on:
- Pending agent tasks queue depth
- Concurrent agent sessions

**Resource Profile**: GPU-enabled nodes for LLM inference (if self-hosted)

---

### 6. Plugin Registry Service
**Purpose**: Manage OpenClaw extensions/plugins

**Responsibilities**:
- Plugin installation/removal
- Plugin health monitoring
- Plugin API proxying

**Technology**: Existing plugin system wrapped as service

---

### 7. Configuration Service
**Purpose**: Centralized configuration management

**Technology**: etcd or Consul

**Features**:
- Dynamic config reload
- Config versioning
- Secret management integration (Vault)

---

## Inter-Service Communication

### Synchronous (Request/Response)
- **gRPC** for internal communication (recommended)
- REST fallback for external/legacy integration

### Asynchronous (Event-Driven)
- **Redis Pub/Sub** or **Apache Kafka** for message passing
- Event types:
  - `message.inbound` - New message received
  - `message.outbound` - Message to send
  - `agent.started` - Agent session started
  - `agent.completed` - Agent task completed
  - `channel.connected` - Channel service online
  - `channel.disconnected` - Channel service offline

### Service Mesh
- **Istio** or **Linkerd** for:
  - mTLS between services
  - Traffic management
  - Observability (distributed tracing)
  - Circuit breaking

---

## Kubernetes Deployment Architecture

### Namespace Structure
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: openclaw
  labels:
    istio-injection: enabled
---
apiVersion: v1
kind: Namespace
metadata:
  name: openclaw-channels
---
apiVersion: v1
kind: Namespace
metadata:
  name: openclaw-system
```

### Sample Deployment: Telegram Service
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: telegram-service
  namespace: openclaw-channels
spec:
  replicas: 3
  selector:
    matchLabels:
      app: telegram-service
  template:
    metadata:
      labels:
        app: telegram-service
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
    spec:
      containers:
      - name: telegram-service
        image: openclaw/telegram-service:latest
        ports:
        - containerPort: 3000
          name: http
        - containerPort: 9090
          name: metrics
        env:
        - name: TELEGRAM_BOT_TOKEN
          valueFrom:
            secretKeyRef:
              name: telegram-credentials
              key: bot-token
        - name: REDIS_URL
          valueFrom:
            configMapKeyRef:
              name: openclaw-config
              key: redis-url
        - name: ACP_SERVER_URL
          valueFrom:
            configMapKeyRef:
              name: openclaw-config
              key: acp-server-url
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        volumeMounts:
        - name: session-storage
          mountPath: /app/sessions
      volumes:
      - name: session-storage
        persistentVolumeClaim:
          claimName: telegram-sessions-pvc
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: telegram-service-hpa
  namespace: openclaw-channels
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: telegram-service
  minReplicas: 2
  maxReplicas: 20
  metrics:
  - type: External
    external:
      metric:
        name: redis_list_length
        selector:
          matchLabels:
            queue: telegram:inbound
      target:
        type: AverageValue
        averageValue: "10"
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

## Observability Stack

### Metrics: Prometheus + Grafana
```yaml
# Service-level metrics endpoint
- Request latency (histogram)
- Request count (counter)
- Active connections (gauge)
- Error rate (counter)
- Queue depth (gauge)
- Channel-specific metrics
```

### Logging: Loki + Promtail
- Structured JSON logging
- Service correlation via trace IDs
- Log levels: ERROR, WARN, INFO, DEBUG

### Distributed Tracing: Jaeger
- OpenTelemetry integration
- Trace propagation across services
- Service dependency mapping

### Health Checks
- **Liveness Probe**: Is the process running?
- **Readiness Probe**: Can the service handle requests?
- **Startup Probe**: Has the service initialized?

---

## Testing Strategy for Microservices

### Unit Testing
```typescript
// Each service maintains its own unit tests
// Example: telegram-service/src/handler.test.ts
import { test, describe } from 'vitest';

describe('TelegramMessageHandler', () => {
  test('should parse incoming message', async () => {
    const handler = new TelegramMessageHandler(mockRedis);
    const result = handler.parse({
      message: { text: 'hello', from: { id: 123 } }
    });
    expect(result.text).toBe('hello');
    expect(result.senderId).toBe('telegram:123');
  });
});
```

### Integration Testing
```typescript
// Service-to-service integration tests
// Example: tests/integration/channel-to-acp.test.ts
describe('Channel to ACP Integration', () => {
  test('should forward message to ACP server', async () => {
    const telegram = new TelegramService(mockConfig);
    const acpClient = new ACPClient(mockConfig);
    
    await telegram.connect();
    await telegram.sendMessage({ text: 'test' });
    
    expect(acpClient.messages).toContainEqual(
      expect.objectContaining({ text: 'test' })
    );
  });
});
```

### Contract Testing
- Consumer-Driven Contracts (Pact)
- Each channel service defines its API contract
- Agent runtime verifies channel contracts

### End-to-End Testing
```yaml
# k8s test environment
apiVersion: v1
kind: Pod
metadata:
  name: e2e-test-runner
spec:
  containers:
  - name: test-runner
    image: openclaw/e2e-tests:latest
    env:
    - name: SERVICES_URL
      valueFrom:
        configMapKeyRef:
          name: test-config
          key: services-url
```

---

## Migration Strategy

### Phase 1: Extract Channel Services (Weeks 1-4)
1. Identify channel boundaries in codebase
2. Create separate npm packages per channel
3. Add Redis message queue for inbound messages
4. Deploy channel services alongside monolithic gateway
5. Gradual traffic shifting (Canary deployment)

### Phase 2: Extract Agent Runtime (Weeks 5-8)
1. Decouple agent execution from gateway
2. Create agent-runtime service
3. Implement gRPC communication
4. Add message queue for agent tasks

### Phase 3: Extract Session Management (Weeks 9-12)
1. Move session storage to Redis cluster
2. Create session-manager service
3. Update all services to use distributed sessions
4. Remove local session state

### Phase 4: Control Plane & API Gateway (Weeks 13-16)
1. Extract ACP server to standalone service
2. Implement API Gateway with routing
3. Add service mesh (Istio)
4. Full decomposition complete

---

## Configuration Management

### Environment-Specific Configs
```yaml
# environments/dev/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization
resources:
- ../../base/openclaw
patches:
- patch: |-
    - op: replace
      path: /spec/template/spec/containers/0/env/0/value
      value: redis-dev.internal
  target:
    kind: Deployment

# environments/prod/kustomization.yaml
```

### Secret Management
```yaml
# Use External Secrets Operator
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: telegram-credentials
spec:
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: telegram-credentials
  data:
  - secretKey: bot-token
    remoteRef:
      key: openclaw/telegram
      property: bot-token
```

---

## Service Catalog & Discovery

### Service Registration
```typescript
// Each service registers on startup
import { Consul } from 'consul';

async function registerService() {
  const consul = new Consul({ host: 'consul' });
  
  await consul.agent.service.register({
    name: 'telegram-service',
    id: 'telegram-service-' + process.env.HOSTNAME,
    address: process.env.HOSTNAME,
    port: 3000,
    check: {
      http: 'http://localhost:3000/health',
      interval: '10s',
      timeout: '5s'
    },
    meta: {
      version: process.env.APP_VERSION,
      capabilities: 'messaging,media'
    }
  });
}
```

---

## Cost Optimization

### Resource Quotas
```yaml
apiVersion: v1
kind: ResourceQuota
metadata:
  name: openclaw-quota
  namespace: openclaw
spec:
  hard:
    requests.cpu: "32"
    requests.memory: 64Gi
    limits.cpu: "64"
    limits.memory: 128Gi
    pods: "100"
    services: "50"
```

### Pod Disruption Budgets
```yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: telegram-service-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: telegram-service
```

---

## Security Considerations

### Network Policies
```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: telegram-service-network-policy
spec:
  podSelector:
    matchLabels:
      app: telegram-service
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - namespaceSelector:
        matchLabels:
          name: openclaw
    ports:
    - protocol: TCP
      port: 3000
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: redis
    ports:
    - protocol: TCP
      port: 6379
  - to:
    - podSelector:
        matchLabels:
          app: acp-server
```

### Service Account & RBAC
```yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: telegram-service-sa
  namespace: openclaw-channels
---
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  name: telegram-service-role
rules:
- apiGroups: [""]
  resources: ["pods", "configmaps"]
  verbs: ["get", "list", "watch"]
---
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: telegram-service-rb
subjects:
- kind: ServiceAccount
  name: telegram-service-sa
roleRef:
  kind: Role
  name: telegram-service-role
  apiGroup: rbac.authorization.k8s.io
```

---

## Summary: Benefits

| Area | Improvement |
|------|-------------|
| **Scalability** | Independent HPA per channel/service |
| **Reliability** | Fault isolation, circuit breakers |
| **Deployability** | Independent channel releases |
| **Testability** | Clear service boundaries, contract testing |
| **Observability** | Per-service metrics, tracing, logging |
| **Enterprise** | RBAC, secret management, compliance |
| **Team Ownership** | Clear boundaries for channel teams |

---

## Next Steps

1. **Create `microservices/` directory** with:
   - `k8s/base/` - Common K8s manifests
   - `k8s/environments/` - Environment-specific overlays
   - `services/` - Extracted service code
   - `docker/` - Service Dockerfiles

2. **Set up Kubernetes cluster** (KIND for local, GKE/EKS/AKS for prod)

3. **Implement service mesh** (Istio recommended)

4. **Create CI/CD pipelines** for each service

5. **Gradual migration** following the phase plan

---

*Document Version: 1.0*  
*Last Updated: 2026-02-26*
