# Agent Runtime Service

The Agent Runtime is a stateless microservice responsible for executing AI agents. It processes tasks from the Control Plane, manages worker pools, and returns results. Designed for horizontal scaling based on workload.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Control Plane   │────▶│  Agent Runtime  │────▶│  Model APIs     │
│  (ACP Server)   │     │  (Port 3002)    │     │ (OpenAI, etc)   │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │    Message      │
                        │    Queue        │
                        │    (Kafka)      │
                        └─────────────────┘
```

## Responsibilities

- **Task Execution**: Execute agent tasks from message queue
- **Worker Pool**: Manage pool of agent workers
- **Model Integration**: Connect to LLM providers (OpenAI, Anthropic, etc.)
- **Streaming**: Stream thinking and responses to Control Plane
- **Resource Management**: CPU/memory management for agent tasks

## Component Design

### Core Components

```
src/
├── index.ts          # Main entry point
├── config.ts         # Configuration loading
├── workers/
│   ├── pool.ts       # Worker pool management
│   ├── worker.ts     # Individual worker
│   └── queue.ts      # Task queue
├── agents/
│   ├── base.ts       # Base agent class
│   ├── chat.ts       # Chat agent
│   └── assistant.ts  # Assistant agent
├── models/
│   ├── openai.ts     # OpenAI provider
│   ├── anthropic.ts  # Anthropic provider
│   └── factory.ts    # Model factory
├── streaming/
│   ├── sse.ts        # Server-Sent Events
│   └── handler.ts    # Stream handler
└── health.ts        # Health checks
```

### Worker Pool Architecture

```
                    ┌──────────────┐
                    │ Task Queue   │
                    │   (Kafka)    │
                    └──────┬───────┘
                           │
         ┌─────────────────┼─────────────────┐
         │                 │                 │
         ▼                 ▼                 ▼
    ┌─────────┐      ┌─────────┐      ┌─────────┐
    │ Worker 1 │      │ Worker 2│      │ Worker N│
    │ (Task A)│      │(Task B) │      │(Task C) │
    └────┬────┘      └────┬────┘      └────┬────┘
         │                 │                 │
         └─────────────────┼─────────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Result Queue │
                    └──────────────┘
```

### Task Lifecycle

```
┌──────────┐    ┌───────────┐    ┌────────────┐    ┌────────────┐
│  QUEUED  │───▶│  STARTED  │───▶│  RUNNING   │───▶│ COMPLETED  │
└──────────┘    └───────────┘    └─────┬──────┘    └────────────┘
                                        │
                                        ▼
                                 ┌────────────┐
                                 │   FAILED   │
                                 └────────────┘
```

## Integration

### Upstream Services

| Service | Protocol | Purpose |
|---------|----------|---------|
| Control Plane | HTTP/gRPC | Task submission |
| Message Queue | Kafka | Task queue |

### Downstream Services

| Service | Protocol | Purpose |
|---------|----------|---------|
| Control Plane | HTTP | Return results |
| OpenAI | HTTPS | LLM API |
| Anthropic | HTTPS | LLM API |
| Session Manager | HTTP | Session context |

### Message Flow

1. **Task Submission**:
   ```
   Control Plane → Agent Runtime (HTTP) → Kafka Queue
   ```

2. **Task Processing**:
   ```
   Kafka Queue → Worker Pool → Model API → Streaming Response
   ```

3. **Result Return**:
   ```
   Worker → Control Plane → API Gateway → Client
   ```

## Configuration

### Environment Variables

```bash
# Server
AGENT_RUNTIME_PORT=3002
AGENT_RUNTIME_HOST=0.0.0.0

# Worker Pool
AGENT_WORKER_POOL_SIZE=5
AGENT_MAX_CONCURRENT=10

# Task Settings
AGENT_MAX_RETRIES=3
AGENT_RETRY_DELAY=1000
AGENT_EXECUTION_TIMEOUT=300000

# Control Plane
CONTROL_PLANE_URL=http://control-plane:8080
ACP_SERVER_URL=http://control-plane:8080
AGENT_HEARTBEAT_INTERVAL=30000

# Model Providers
DEFAULT_MODEL_PROVIDER=openai
OPENAI_API_KEY=
ANTHROPIC_API_KEY=

# Message Queue
KAFKA_BROKERS=kafka-headless:9092
KAFKA_CONSUMER_GROUP=agent-runtime
KAFKA_TASK_TOPIC=openclaw.agent.tasks
KAFKA_RESULT_TOPIC=openclaw.agent.results
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: agent-runtime
spec:
  replicas: 3
  selector:
    matchLabels:
      app: agent-runtime
  template:
    spec:
      containers:
      - name: agent-runtime
        image: openclaw/agent-runtime:2026.2.26
        ports:
        - containerPort: 3002
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 2Gi
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: model-credentials
              key: openai-api-key
        - name: ANTHROPIC_API_KEY
          valueFrom:
            secretKeyRef:
              name: model-credentials
              key: anthropic-api-key
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-runtime
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-runtime
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60
```

## Testing

```bash
# Unit tests
npm test

# Health check
curl http://localhost:3002/health

# Submit task
curl -X POST http://localhost:3002/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-123",
    "agentType": "chat",
    "model": "gpt-4",
    "messages": [
      {"role": "user", "content": "Hello!"}
    ]
  }'
```

## Example Usage

### Submit Chat Task

```bash
curl -X POST http://localhost:3002/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "taskId": "task-abc123",
    "agentType": "chat",
    "config": {
      "model": "gpt-4",
      "systemPrompt": "You are a helpful assistant.",
      "temperature": 0.7,
      "maxTokens": 1000
    },
    "messages": [
      {"role": "user", "content": "What is TypeScript?"}
    ]
  }'
```

### Stream Response

```bash
curl -N http://localhost:3002/api/v1/tasks/task-abc123/stream \
  -H "Accept: text/event-stream"
```

### Response Format

```json
{
  "taskId": "task-abc123",
  "status": "completed",
  "result": {
    "message": {
      "role": "assistant",
      "content": "TypeScript is..."
    },
    "usage": {
      "promptTokens": 50,
      "completionTokens": 200,
      "totalTokens": 250
    }
  },
  "duration": 2500
}
```

## Observability

- **Metrics**:
  - `agent_tasks_queued` - Gauge
  - `agent_tasks_running` - Gauge
  - `agent_tasks_completed_total` - Counter
  - `agent_tasks_failed_total` - Counter
  - `agent_execution_duration` - Histogram
  - `model_api_latency` - Histogram

- **Logs**: Structured JSON with task ID correlation
- **Traces**: OpenTelemetry span per task execution
