# API Gateway Service

The API Gateway is the entry point for all client connections to the OpenClaw system. It handles routing, authentication, rate limiting, and request/response transformation.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   Client Apps   │────▶│   API Gateway   │────▶│ Control Plane  │
│  (Web/Mobile)   │     │   (Port 3000)   │     │   (ACP Server) │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ Discord Channel │   │ Telegram Channel│   │  Slack Channel │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## Responsibilities

- **Request Routing**: Route incoming requests to appropriate backend services
- **Authentication**: JWT-based auth for client connections
- **Rate Limiting**: Per-user, per-channel rate limiting
- **TLS Termination**: Secure HTTPS endpoints
- **Request/Response Transform**: Normalize message formats between clients and services
- **Load Balancing**: Distribute load across service instances

## Component Design

### Core Components

```
src/
├── index.ts          # Main entry point, Express server setup
├── config.ts         # Configuration loading from env
├── middleware/
│   ├── auth.ts       # JWT authentication middleware
│   ├── rateLimit.ts  # Rate limiting (token bucket)
│   ├── logging.ts    # Request/response logging
│   └── tracing.ts    # OpenTelemetry tracing
├── routes/
│   ├── messages.ts   # Message sending/receiving
│   ├── sessions.ts  # Session management
│   ├── agents.ts    # Agent control
│   └── channels.ts  # Channel configuration
├── services/
│   ├── router.ts     # Service discovery & routing
│   └── transform.ts  # Message transformation
└── health.ts        # Health check endpoints
```

### Key APIs

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |
| `/api/v1/messages` | POST | Send message |
| `/api/v1/messages` | GET | List messages |
| `/api/v1/sessions` | GET | List sessions |
| `/api/v1/agents/:id` | POST | Start agent |
| `/api/v1/agents/:id` | DELETE | Stop agent |
| `/api/v1/channels` | GET | List channels |

## Integration

### Upstream (Clients)

- Web applications (browser)
- Mobile apps (iOS/Android)
- Third-party integrations via REST API

### Downstream Services

| Service | Protocol | Purpose |
|---------|----------|---------|
| Control Plane | HTTP/gRPC | ACP protocol, agent management |
| Session Manager | HTTP | Session state |
| Discord Channel | HTTP | Discord messaging |
| Telegram Channel | HTTP | Telegram messaging |
| Slack Channel | HTTP | Slack messaging |
| WhatsApp Channel | HTTP | WhatsApp messaging |

### Message Flow

1. Client sends authenticated request to API Gateway
2. Gateway validates JWT token
3. Gateway applies rate limiting
4. Gateway transforms request and routes to appropriate service
5. Service processes request
6. Gateway transforms response and returns to client

## Configuration

### Environment Variables

```bash
# Server
API_GATEWAY_PORT=3000
API_GATEWAY_HOST=0.0.0.0

# Authentication
JWT_SECRET=your-secret-key
JWT_EXPIRY=24h

# Rate Limiting
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100

# Service URLs
CONTROL_PLANE_URL=http://control-plane:8080
SESSION_MANAGER_URL=http://session-manager:3001
DISCORD_CHANNEL_URL=http://channel-discord:3000
TELEGRAM_CHANNEL_URL=http://channel-telegram:3000
SLACK_CHANNEL_URL=http://channel-slack:3000
WHATSAPP_CHANNEL_URL=http://channel-whatsapp:3000
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  selector:
    matchLabels:
      app: api-gateway
  template:
    spec:
      containers:
      - name: api-gateway
        image: openclaw/api-gateway:2026.2.26
        ports:
        - containerPort: 3000
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
          limits:
            cpu: 1000m
            memory: 512Mi
        env:
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: api-gateway-secrets
              key: jwt-secret
---
apiVersion: v1
kind: Service
metadata:
  name: api-gateway
spec:
  type: ClusterIP
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: api-gateway
```

## Testing

```bash
# Unit tests
npm test

# Integration tests
npm run test:integration

# Health check
curl http://localhost:3000/health
```

## Observability

- **Metrics**: `/metrics` endpoint (Prometheus format)
- **Tracing**: OpenTelemetry integration
- **Logging**: Structured JSON logs with trace IDs

## Example Usage

### Send a Message

```bash
curl -X POST http://api-gateway/api/v1/messages \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "channel": "discord",
    "recipient": "user#1234",
    "content": "Hello from OpenClaw!"
  }'
```

### Start an Agent

```bash
curl -X POST http://api-gateway/api/v1/agents \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "assistant",
    "model": "gpt-4",
    "systemPrompt": "You are a helpful assistant."
  }'
```
