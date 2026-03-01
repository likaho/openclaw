# Discord Channel Service

The Discord Channel Service is a microservice that handles all Discord messaging functionality. It connects to Discord's API using Discord.js, processes inbound messages, sends outbound messages, and manages Discord-specific features.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Discord Users   │────▶│ Discord Channel │────▶│ Control Plane   │
│                 │     │   (Port 3000)   │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │     Redis       │
                        │  (Rate Limiting)│
                        └─────────────────┘
```

## Responsibilities

- **Discord Connection**: Connect to Discord Gateway and API
- **Message Handling**: Receive and process inbound Discord messages
- **Message Sending**: Send messages to Discord channels/DMs
- **Event Processing**: Handle Discord events (reactions, edits, etc.)
- **Rate Limiting**: Manage Discord's rate limits per channel/guild
- **Webhook Handling**: Process Discord webhooks

## Component Design

### Core Components

```
src/
├── index.ts          # Main entry point, Discord client
├── config.ts         # Configuration loading
├── client/
│   ├── setup.ts     # Discord client setup
│   ├── events.ts    # Event handlers
│   └── handlers.ts  # Message handlers
├── messages/
│   ├── inbound.ts   # Process incoming messages
│   ├── outbound.ts # Send outgoing messages
│   └── transform.ts # Message format conversion
├── discord/
│   ├── client.ts    # Discord client wrapper
│   ├── gateway.ts   # Gateway connection
│   └── api.ts       # REST API wrapper
├── rateLimit/
│   ├── manager.ts   # Rate limit manager
│   └── bucket.ts    # Token bucket implementation
├── cache/
│   └── redis.ts     # Redis caching
└── health.ts       # Health checks
```

### Discord Intents

The service uses the following Discord intents:
- `GUILDS` - Server/guild operations
- `GUILD_MESSAGES` - Message events in guilds
- `DIRECT_MESSAGES` - Direct message events
- `MESSAGE_CONTENT` - Access to message content
- `GUILD_MESSAGE_REACTIONS` - Reaction events

### Message Flow

```
Discord User
     │
     ▼ (Discord Gateway)
Discord Client (WebSocket)
     │
     ▼ (Process Event)
Message Handler
     │
     ▼ (Transform)
Control Plane (HTTP/Kafka)
     │
     ▼ (Response)
Discord Client (REST API)
     │
     ▼
Discord Channel
```

## Integration

### Upstream

| Source | Protocol | Purpose |
|--------|----------|---------|
| Discord Gateway | WebSocket | Inbound events |
| Discord API | REST | Outbound messages |

### Downstream

| Service | Protocol | Purpose |
|---------|----------|---------|
| Control Plane | HTTP/Kafka | Message routing |
| Session Manager | HTTP | Session state |
| Redis | Redis | Rate limiting, caching |

### Event Types Handled

| Event | Action |
|-------|--------|
| `messageCreate` | Process new message |
| `messageUpdate` | Handle edit |
| `messageDelete` | Handle deletion |
| `interactionCreate` | Handle slash commands |
| `reactionAdd` | Handle reactions |

## Configuration

### Environment Variables

```bash
# Server
CHANNEL_PORT=3000

# Discord
DISCORD_BOT_TOKEN=       # Set via secret
DISCORD_GUILD_ID=        # Optional: specific guild
DISCORD_INTENTS=32768    # GUILD_MESSAGES | DIRECT_MESSAGES

# Discord-specific
DISCORD_MAX_MESSAGE_LENGTH=2000
DISCORD_RATE_LIMIT_DELAY=1000

# Service URLs
CONTROL_PLANE_URL=http://control-plane:8080
SESSION_MANAGER_URL=http://session-manager:3001
REDIS_HOST=redis-master
REDIS_PORT=6379
```

### Required Permissions

The Discord bot needs these permissions:
- `READ_MESSAGES` or `READ_MESSAGE_HISTORY`
- `SEND_MESSAGES`
- `EMBED_LINKS`
- `ATTACH_FILES`
- `MANAGE_MESSAGES` (optional)
- `USE_EXTERNAL_EMOJIS` (optional)

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: channel-discord
spec:
  replicas: 2
  selector:
    matchLabels:
      app: channel-discord
  template:
    spec:
      containers:
      - name: channel-discord
        image: openclaw/channel-discord:2026.2.26
        ports:
        - containerPort: 3000
        resources:
          requests:
            cpu: 100m
            memory: 128Mi
          limits:
            cpu: 500m
            memory: 512Mi
        env:
        - name: DISCORD_BOT_TOKEN
          valueFrom:
            secretKeyRef:
              name: channel-credentials
              key: discord-bot-token
        - name: CONTROL_PLANE_URL
          value: http://control-plane:8080
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: channel-discord
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: channel-discord
  minReplicas: 1
  maxReplicas: 10
```

## Testing

```bash
# Run tests
npm test

# Health check
curl http://localhost:3000/health

# Test Discord connection
curl http://localhost:3000/health/discord
```

## Example Usage

### Send Message

```typescript
const message = await discordChannel.sendMessage({
  channelId: '123456789',
  content: 'Hello from OpenClaw!',
  embeds: [{
    title: 'Welcome',
    description: 'This is an embedded message'
  }]
});
```

### Handle Inbound Message

```typescript
// Messages are automatically forwarded to Control Plane
// Format: InboundMessage
{
  channel: 'discord',
  channelMessageId: 'msg-123',
  channelUserId: 'user-456',
  channelGuildId: 'guild-789',
  content: 'Hello bot!',
  timestamp: 1700000000000,
  metadata: {
    channelType: 'guild',
    messageType: 'default'
  }
}
```

## Observability

- **Metrics**:
  - `discord_messages_received_total`
  - `discord_messages_sent_total`
  - `discord_gateway_latency`
  - `discord_rate_limit_hits`

- **Logs**: Structured JSON with Discord IDs
- **Traces**: OpenTelemetry with channel context

## Discord-Specific Features

### Slash Commands

Register slash commands:
```typescript
await client.application.commands.create({
  name: 'ask',
  description: 'Ask the AI assistant',
  options: [{
    name: 'question',
    type: 'STRING',
    description: 'Your question',
    required: true
  }]
});
```

### Rich Embeds

```typescript
const embed = {
  title: 'Agent Response',
  description: result.content,
  color: 0x0099FF,
  timestamp: new Date().toISOString(),
  footer: { text: 'OpenClaw AI' }
};
```
