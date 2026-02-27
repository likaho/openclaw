# OpenClaw Microservices Migration Guide

This document provides a detailed, step-by-step implementation plan for migrating the OpenClaw monolith to microservices.

---

## Phase 1: Extract Channel Services (Weeks 1-4)

### Goals
- Decouple each messaging channel into independent services
- Enable independent scaling and deployment
- Add message queue for async communication

### Prerequisites
- Redis cluster deployed
- Kubernetes cluster ready
- CI/CD pipelines configured

### Implementation Steps

#### Week 1: Analysis & Preparation

```
Day 1-2: Identify Channel Boundaries
├── Analyze src/channels/ directory
├── Analyze src/discord/, src/telegram/, src/slack/, src/web/
├── Identify shared dependencies (utils, config, logger)
└── Document each channel's:
    - Entry points (webhook handlers)
    - Outbound API calls
    - Session state usage
    - Configuration requirements

Day 3-4: Create Channel Package Structure
├── Create services/channel-discord/
│   ├── package.json
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts          # Service entry
│       ├── handler.ts        # Message handler
│       ├── config.ts         # Channel config
│       └── types.ts          # Type definitions
├── Repeat for each channel (telegram, slack, whatsapp)
└── Create services/shared/ for common code
```

#### Week 2: Core Channel Implementation

```
Day 5-6: Implement Base Channel Service
├── Create BaseChannelService class
│   ├── connect() / disconnect()
│   ├── sendMessage() / sendMedia()
│   ├── getStatus()
│   └── healthCheck()
├── Define ChannelServiceInterface
├── Add message queue publisher
└── Add Redis client for session lookup

Day 7-8: Implement First Channel (Discord)
├── Port src/discord/ logic to service
├── Implement Discord bot API client
├── Add webhook handler
├── Add message queue producer
└── Test locally with Redis

Day 9-10: Implement Remaining Channels
├── Telegram service
├── Slack service
├── WhatsApp service
└── Test each channel
```

#### Week 3: Kubernetes Deployment

```
Day 11-12: Create K8s Manifests
├── Create channel namespace (already done)
├── Create Discord deployment
├── Create Telegram deployment
├── Create Slack deployment
├── Create WhatsApp deployment
├── Add HPA configurations
└── Add PodDisruptionBudgets

Day 13-14: Deploy to Staging
├── Deploy Redis (if not already)
├── Deploy channel services
├── Configure service discovery
├── Setup ingress for webhooks
└── Test message flow

Day 15-16: Integration Testing
├── Test message inbound flow
├── Test message outbound flow
├── Test error handling
├── Test reconnection logic
└── Test scaling behavior
```

#### Week 4: Traffic Shifting (Canary)

```
Day 17-18: Setup Canary Routing
├── Configure Istio/virtual service
├── Create canary weights (10%, 25%, 50%)
├── Setup metrics collection
└── Prepare rollback procedures

Day 19-20: Gradual Rollout
├── Deploy v1 channel services (10% traffic)
├── Monitor error rates and latency
├── Increase to 25% if healthy
├── Monitor for 24 hours
├── Continue increase or rollback
└── Document findings

Day 21-28: Production Migration
├── Continue gradual rollout
├── Monitor dashboards
├── Handle production issues
├── Update runbooks
└── Complete when 100% on new services
```

---

## Phase 2: Extract Agent Runtime (Weeks 5-8)

### Goals
- Decouple AI agent execution from gateway
- Enable scaling based on agent task load
- Add message queue for task distribution

### Implementation Steps

#### Week 5: Agent Service Design

```
Day 29-30: Analyze Agent Dependencies
├── Analyze src/agents/ directory
├── Identify:
│   ├── LLM API clients (Anthropic, OpenAI, etc.)
│   ├── Tool executors (bash, file, browser)
│   ├── Session context requirements
│   └── State management
└── Document service boundaries

Day 31-32: Design Service Architecture
├── Create AgentRuntimeService
│   ├── Task queue consumer
│   ├── Agent state machine
│   ├── Tool executor pool
│   ├── LLM client abstraction
│   └── Result publisher
├── Define gRPC contract
├── Design task/message formats
└── Plan resource requirements
```

#### Week 6: Implementation

```
Day 33-35: Core Implementation
├── Create agent-runtime service
├── Implement task queue consumer
├── Implement agent state machine
├── Add LLM client support
├── Add tool executor support
└── Test with mock LLM

Day 36-38: Tool Integration
├── Bash tool executor
├── File system tool executor
├── Browser tool executor
├── HTTP request tool
├── Tool sandboxing
└── Tool timeout handling

Day 39-40: Message Queue Integration
├── Connect to Kafka
├── Implement task serialization
├── Handle task acknowledgments
├── Add retry logic
└── Test end-to-end flow
```

#### Week 7: Deployment & Integration

```
Day 41-42: Kubernetes Deployment
├── Create agent-runtime deployment
├── Configure HPA (queue depth metrics)
├── Add persistent workspace (PVC)
├── Setup service discovery
└── Deploy to staging

Day 43-44: Integration Testing
├── Test task submission
├── Test agent execution
├── Test tool execution
├── Test result delivery
├── Test error handling
└── Test timeout handling
```

#### Week 8: Traffic Migration

```
Day 45-48: Gradual Migration
├── Start with 10% traffic via canary
├── Monitor execution times
├── Monitor error rates
├── Adjust scaling parameters
└── Continue gradual increase
```

---

## Phase 3: Extract Session Management (Weeks 9-12)

### Goals
- Centralize session state in Redis
- Create session-manager service
- Remove local session state from all services

### Implementation Steps

#### Week 9: Session Store Design

```
Day 49-50: Analyze Session Usage
├── Identify all session references
├── Document session schema
├── Identify session-related queries
├── Plan migration strategy
└── Design session-manager API

Day 51-52: Redis Cluster Setup
├── Deploy Redis cluster
├── Configure persistence
├── Setup replication
├── Configure backups
└── Test failover
```

#### Week 10: Session Manager Service

```
Day 53-55: Implement Session Manager
├── Create session-manager service
├── Implement CRUD operations
├── Add session locking
├── Add session TTL management
├── Add session queries
└── Add audit logging

Day 56-57: Update Existing Services
├── Update API Gateway
├── Update Control Plane
├── Update Agent Runtime
├── Update Channel Services
└── Update Plugin Registry
```

#### Week 11-12: Migration

```
Day 58-64: Migrate Sessions
├── Deploy session-manager
├── Enable dual-write mode
├── Migrate existing sessions
├── Verify data integrity
├── Switch to read from Redis
├── Remove local session storage
└── Monitor for issues
```

---

## Phase 4: Control Plane & API Gateway (Weeks 13-16)

### Goals
- Extract ACP server to standalone service
- Implement API Gateway with routing
- Add service mesh (Istio)
- Complete microservices decomposition

### Implementation Steps

#### Week 13: ACP Server Extraction

```
Day 65-67: Analyze ACP Protocol
├── Analyze src/acp/ directory
├── Identify protocol handlers
├── Identify state requirements
├── Design service boundaries
└── Plan communication

Day 68-70: Implement Control Plane Service
├── Create control-plane service
├── Implement ACP protocol
├── Add session coordination
├── Add message routing
├── Add rate limiting
└── Test ACP functionality
```

#### Week 14: API Gateway Implementation

```
Day 71-73: Gateway Refactoring
├── Analyze current gateway code
├── Implement routing layer
├── Add authentication
├── Add authorization
├── Add rate limiting
└── Add request/response transformation

Day 74-76: Service Mesh Setup
├── Install Istio
├── Configure mTLS
├── Setup traffic policies
├── Configure circuit breakers
└── Add observability
```

#### Week 15-16: Final Integration

```
Day 77-84: Integration & Testing
├── Deploy all services
├── Configure routing
├── Test all communication paths
├── Test failure scenarios
├── Test scaling
├── Test monitoring
└── Complete end-to-end testing

Day 85-92: Production Cutover
├── Deploy to production
├── Monitor closely
├── Handle issues
├── Complete migration
└── Document lessons learned
```

---

## Rollback Procedures

### Channel Services Rollback
```bash
# Revert traffic to monolith
kubectl apply -f rollback/channel-10%.yaml

# Stop channel services
kubectl delete -f k8s/channels/

# Restart monolithic gateway
kubectl rollout restart deployment/gateway
```

### Agent Runtime Rollback
```bash
# Redirect to inline execution in gateway
kubectl set env deployment/gateway AGENT_RUNTIME_ENABLED=false

# Stop agent-runtime service
kubectl delete -f k8s/agent-runtime/
```

### Session Manager Rollback
```bash
# Enable local session storage
kubectl set env deployment/gateway SESSION_MODE=local

# Revert session reads
kubectl apply -f rollback/session-config.yaml
```

---

## Monitoring & Alerts

### Key Metrics
- Service latency (p50, p95, p99)
- Error rates by service
- Queue depth (Kafka/Redis)
- Active sessions
- Agent task duration
- Channel message throughput

### Alerting Rules
```yaml
- alert: HighErrorRate
  expr: rate(errors_total[5m]) > 0.01
  for: 5m
  
- alert: QueueBacklog
  expr: kafka_consumer_lag > 1000
  for: 10m
  
- alert: ServiceDown
  expr: up{job="channel-.*"} == 0
  for: 2m
```

---

## Success Criteria

### Phase 1 Success
- [ ] All channels running as separate services
- [ ] < 1% error rate during canary
- [ ] Independent scaling working
- [ ] Rollback procedure tested

### Phase 2 Success
- [ ] Agent tasks processed via queue
- [ ] < 5s average task duration
- [ ] Independent scaling based on queue depth
- [ ] Tool execution isolated

### Phase 3 Success
- [ ] All sessions in Redis
- [ ] < 100ms session access latency
- [ ] Session manager highly available
- [ ] No local session storage

### Phase 4 Success
- [ ] ACP server standalone
- [ ] API Gateway routing correctly
- [ ] mTLS enabled between services
- [ ] Circuit breakers configured
- [ ] Full decomposition complete

---

## Team Structure

### Phase 1 Team (2-3 engineers)
- 1 backend engineer (channel implementation)
- 1 platform engineer (K8s/infrastructure)
- 1 QA (testing/verification)

### Phase 2-4 Team (3-4 engineers)
- 1 backend engineer (agent runtime)
- 1 platform engineer (K8s/mesh)
- 1-2 backend engineers (integration)
- 1 QA (testing/verification)

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|-----------------|
| Phase 1 | 4 weeks | Channel services deployed |
| Phase 2 | 4 weeks | Agent runtime service |
| Phase 3 | 4 weeks | Session manager |
| Phase 4 | 4 weeks | Full decomposition |
| **Total** | **16 weeks** | **Production-ready microservices** |
