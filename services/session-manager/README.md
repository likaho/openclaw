# Session Manager Service

The Session Manager is a stateful microservice responsible for managing user sessions across all channels. It provides persistent session storage, session state tracking, and session lifecycle management.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   API Gateway   │────▶│ Session Manager │────▶│     Redis       │
│                 │     │   (Port 3001)   │     │   (Storage)     │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│Discord Channel  │   │Telegram Channel │   │  Slack Channel  │
└─────────────────┘   └─────────────────┘   └─────────────────┘
```

## Responsibilities

- **Session Storage**: Persist session data in Redis
- **Session Lifecycle**: Create, update, delete, expire sessions
- **Session State**: Track user context, conversation history
- **Multi-channel Sessions**: Support sessions across multiple channels per user
- **Session Analytics**: Track session metrics (message count, duration)

## Component Design

### Core Components

```
src/
├── index.ts          # Main entry point, Express server
├── config.ts         # Configuration loading
├── redis/
│   ├── client.ts     # Redis client setup
│   └── keys.ts       # Key naming conventions
├── sessions/
│   ├── store.ts      # Session CRUD operations
│   ├── cache.ts      # In-memory cache layer
│   └── cleanup.ts    # Expired session cleanup
├── middleware/
│   ├── auth.ts       # Session authentication
│   └── tracking.ts   # Activity tracking
├── routes/
│   ├── sessions.ts   # Session API routes
│   └── users.ts      # User session routes
└── health.ts        # Health checks
```

### Data Model

```typescript
interface Session {
  id: string;                    // Unique session ID
  userId: string;                 // User identifier
  channel: string;                // Primary channel (discord, telegram, etc.)
  channelUserId: string;         // Channel-specific user ID
  
  // Timestamps
  createdAt: number;             // Session creation time
  updatedAt: number;             // Last update time
  expiresAt: number;             // Expiration time
  lastActivityAt: number;       // Last activity timestamp
  
  // State
  status: 'active' | 'paused' | 'ended';
  metadata: Record<string, unknown>;
  
  // Agent info
  agentId?: string;
  agentState?: Record<string, unknown>;
}

interface SessionMetadata {
  messageCount: number;
  totalMessages: number;
  firstMessageAt?: number;
  lastMessageAt?: number;
  
  // Channel-specific
  discordGuildId?: string;
  telegramChatId?: string;
  slackChannelId?: string;
}
```

### Redis Key Schema

```
session:{channel}:{userId}      # Main session data (Hash)
session:{channel}:{userId}:meta # Session metadata (Hash)
session:{channel}:{userId}:msgs # Message history (List)
session:index:{channel}          # Session index per channel (Set)
user:{userId}:sessions          # All sessions for user (Set)
```

## Integration

### Upstream Services

| Service | Protocol | Purpose |
|---------|----------|---------|
| API Gateway | HTTP | Session management requests |
| Control Plane | HTTP | Agent-session binding |
| All Channels | HTTP | Session updates |

### Downstream Services

| Service | Protocol | Purpose |
|---------|----------|---------|
| Redis | Redis | Persistent storage |

### Message Flow

1. **Session Creation**:
   ```
   Client → API Gateway → Session Manager → Redis
   ```

2. **Session Update** (on message):
   ```
   Channel → Session Manager → Redis
   ```

3. **Session Query**:
   ```
   Agent Runtime → Session Manager → Redis → Session Manager → Agent Runtime
   ```

## Configuration

### Environment Variables

```bash
# Server
SESSION_MANAGER_PORT=3001
SESSION_MANAGER_HOST=0.0.0.0

# Redis
REDIS_HOST=redis-master
REDIS_PORT=6379
REDIS_PASSWORD=
REDIS_DB=0
REDIS_CLUSTER_NODES=

# Session Settings
SESSION_MAX_AGE=86400000        # 24 hours in ms
SESSION_CLEANUP_INTERVAL=300000 # 5 minutes
SESSION_MAX_MESSAGES=1000       # Max messages per session

# Cache
SESSION_CACHE_TTL=60000         # 1 minute cache TTL
SESSION_CACHE_SIZE=1000         # Max cached sessions
```

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: session-manager
spec:
  replicas: 1
  selector:
    matchLabels:
      app: session-manager
  template:
    spec:
      containers:
      - name: session-manager
        image: openclaw/session-manager:2026.2.26
        ports:
        - containerPort: 3001
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        env:
        - name: REDIS_HOST
          value: redis-master
        - name: REDIS_PASSWORD
          valueFrom:
            secretKeyRef:
              name: redis-credentials
              key: password
---
apiVersion: v1
kind: Service
metadata:
  name: session-manager
spec:
  type: ClusterIP
  ports:
  - port: 3001
    targetPort: 3001
  selector:
    app: session-manager

# Persistent storage (if using local Redis)
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: session-manager-redis
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 10Gi
```

## Testing

```bash
# Unit tests
npm test

# Integration test
npm run test:integration

# Health check
curl http://localhost:3001/health

# Create session
curl -X POST http://localhost:3001/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-123",
    "channel": "discord",
    "channelUserId": "discord:123456789"
  }'
```

## Example Usage

### Create Session

```bash
curl -X POST http://localhost:3001/api/v1/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-456",
    "channel": "telegram",
    "channelUserId": "telegram:987654321",
    "metadata": {
      "firstName": "John",
      "language": "en"
    }
  }'
```

### Get Session

```bash
curl http://localhost:3001/api/v1/sessions/telegram:user-456
```

### Update Session

```bash
curl -X PATCH http://localhost:3001/api/v1/sessions/telegram:user-456 \
  -H "Content-Type: application/json" \
  -d '{
    "metadata": {
      "messageCount": 10,
      "lastMessageAt": 1700000000000
    }
  }'
```

### Delete Session

```bash
curl -X DELETE http://localhost:3001/api/v1/sessions/telegram:user-456
```

## Observability

- **Metrics**:
  - `session_creations_total` - Counter
  - `session_deletions_total` - Counter
  - `active_sessions` - Gauge
  - `session_message_count` - Histogram

- **Logs**: Structured JSON with session ID correlation
- **Traces**: OpenTelemetry with session context propagation
