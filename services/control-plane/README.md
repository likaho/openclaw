# Control Plane Service

The Control Plane is the ACP (Agent Communication Protocol) server that manages agent lifecycle, message routing, and coordinates communication between channels and agent runtime.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│   Control Plane │────▶│ Agent Runtime   │
│                 │     │   (ACP Server)  │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Discord Channel │   │Telegram Channel │   │  Slack Channel  │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## Responsibilities

- **ACP Protocol Server**: Implement the Agent Communication Protocol
- **Agent Lifecycle**: Start, stop, pause, resume agents
- **Message Routing**: Route messages between channels and agents
- **Session Coordination**: Coordinate with Session Manager for state
- **Agent Registry**: Keep track of active agents and their capabilities

## Component Design

### Core Components

```
src/
├── index.ts          # Main entry point, ACP server setup
├── config.ts         # Configuration loading
├── acp/
│   ├── server.ts     # ACP protocol implementation
│   ├── protocol.ts   # Message types and handlers
│   └── session.ts    # ACP session management
├── agents/
│   ├── registry.ts   # Agent registration and tracking
│   ├── lifecycle.ts  # Agent lifecycle management
│   └── pool.ts       # Agent worker pool
├── messaging/
│   ├── router.ts     # Message routing logic
│   ├── queue.ts      # Message queue management
│   └── transform.ts  # Message format transformation
└── health.ts        # Health checks
```

### ACP Protocol

The ACP (Agent Communication Protocol) is the core communication protocol:

| Message Type | Direction | Description |
|--------------|-----------|-------------|
| `agent.start` | Client → ACP | Start a new agent |
| `agent.stop` | Client → ACP | Stop an agent |
| `agent.pause` | Client → ACP | Pause agent execution |
| `agent.resume` | Client → ACP | Resume agent execution |
| `message.send` | Bidirectional | Send a message |
| `message.receive` | Channel → ACP | Receive inbound message |
| `agent.thinking` | ACP → Client | Stream thinking process |
| `agent.response` | ACP → Client | Final agent response |
| `agent.error` | ACP → Client | Error notification |

### Agent States

```
        ┌──────────┐
        │ INITIAL  │
        └────┬─────┘
             │ start
             ▼
    ┌───────────────┐
    │   STARTING    │
    └───────┬───────┘
            │ running
            ▼
    ┌───────────────┐
    │    RUNNING    │◀─────────────┐
    └───────┬───────┘              │
            │                      │
     ┌──────┴──────┐               │
     │             │               │
     ▼             ▼               │
┌─────────┐  ┌─────────┐           │
│ PAUSED  │  │IDLE    │           │
└────┬────┘  └────┬────┘           │
     │            │                 │
     └─────┬──────┘                 │
           │ stop                    │
           ▼                         │
    ┌───────────────┐                │
    │    STOPPED    │────────────────┘
    └───────────────┘
```

## Integration

### Upstream Services

| Service | Protocol | Purpose |
|---------|----------|---------|
| API Gateway | HTTP/gRPC | Client requests |
| Session Manager | HTTP | Session state |

### Downstream Services

| Service | Protocol | Purpose |
|---------|----------|---------|
| Agent Runtime | HTTP/gRPC | Execute agent tasks |
| Discord Channel | Kafka/REST | Discord messaging |
| Telegram Channel | Kafka/REST | Telegram messaging |
| Slack Channel | Kafka/REST | Slack messaging |
| WhatsApp Channel | Kafka/REST | WhatsApp messaging |

### Message Flow

1. **Inbound Message Flow**:
   ```
   Channel → Control Plane → Agent Runtime → Control Plane → Channel → Client
   ```

2. **Agent Start Flow**:
   ```
   Client → API Gateway → Control Plane → Agent Runtime
   ```

## Configuration

### Environment Variables

```bash
# Server
ACP_SERVER_PORT=8080
ACP_SERVER_HOST=0.0.0.0

# Protocol
ACP_MAX_MESSAGE_SIZE=10485760  # 10MB
ACP_HEARTBEAT_INTERVAL=30000
ACP_SESSION_TIMEOUT=300000

# Agent Management
AGENT_MAX_CONCURRENT=10
AGENT_EXECUTION_TIMEOUT=300000

# Service URLs
AGENT_RUNTIME_URL=http://agent-runtime:3002
SESSION_MANAGER_URL=http://session-manager:3001
KAFKA_BROKERS=kafka-headless:9092
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: control-plane
spec:
  replicas: 2
  selector:
    matchLabels:
      app: control-plane
  template:
    spec:
      containers:
      - name: control-plane
        image: openclaw/control-plane:2026.2.26
        ports:
        - containerPort: 8080
        resources:
          requests:
            cpu: 500m
            memory: 512Mi
          limits:
            cpu: 2000m
            memory: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: control-plane
spec:
  type: ClusterIP
  ports:
  - port: 8080
    targetPort: 8080
  selector:
    app: control-plane
```

## Testing

```bash
# Start ACP server locally
npm run dev

# Health check
curl http://localhost:8080/health

# Start agent example
curl -X POST http://localhost:8080/api/v1/agents \
  -H "Content-Type: application/json" \
  -d '{
    "type": "assistant",
    "config": {
      "model": "gpt-4",
      "systemPrompt": "You are helpful."
    }
  }'
```

## Observability

- **Metrics**: `/metrics` endpoint with Prometheus format
- **Traces**: OpenTelemetry integration with trace propagation
- **Logs**: Structured JSON with agent correlation IDs

## Example Usage

### Start an Agent

```bash
curl -X POST http://localhost:8080/agent/start \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "assistant-001",
    "type": "chat",
    "model": "gpt-4",
    "systemPrompt": "You are a helpful coding assistant."
  }'
```

### Send Message to Agent

```bash
curl -X POST http://localhost:8080/message/send \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "assistant-001",
    "content": "Hello, help me write a function.",
    "channel": "discord"
  }'
```

### Stream Agent Response

```bash
curl -N http://localhost:8080/agent/assistant-001/stream \
  -H "Accept: text/event-stream"
```
