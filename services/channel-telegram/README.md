# Telegram Channel Service

The Telegram Channel Service is a microservice that handles all Telegram messaging functionality. It connects to the Telegram Bot API, processes inbound messages, and sends outbound messages.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ Telegram Users  │────▶│Telegram Channel │────▶│ Control Plane   │
│                 │     │   (Port 3000)   │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Telegram API    │
                        │ (webhooks/      │
                        │  long-polling)  │
                        └─────────────────┘
```

## Responsibilities

- **Telegram Connection**: Connect via webhooks or long-polling
- **Message Handling**: Receive and process inbound messages
- **Message Sending**: Send text, media, and interactive messages
- **Callback Queries**: Handle inline keyboard callbacks
- **Commands**: Process bot commands (/start, /help, etc.)
- **User Management**: Track user info and preferences

## Component Design

### Core Components

```
src/
├── index.ts          # Main entry point
├── config.ts         # Configuration
├── client/
│   ├── telegram.ts   # Telegram API client
│   ├── webhooks.ts  # Webhook handler
│   └── polling.ts   # Long-polling handler
├── messages/
│   ├── inbound.ts   # Process incoming
│   ├── outbound.ts  # Send messages
│   └── transform.ts # Format conversion
├── handlers/
│   ├── message.ts   # Message handler
│   ├── callback.ts  # Callback query handler
│   └── command.ts   # Command handler
├── keyboard/
│   ├── inline.ts    # Inline keyboards
│   └── reply.ts     # Reply keyboards
└── health.ts       # Health checks
```

### Connection Modes

| Mode | Description | Use Case |
|------|------------|----------|
| Webhook | Telegram calls your URL | Production, scalable |
| Long-Polling | You poll Telegram | Development, testing |

### Message Flow

```
Telegram User
     │
     ▼ (Webhook/Long-Polling)
Telegram Handler
     │
     ▼ (Parse Update)
Message Processor
     │
     ▼ (Transform)
Control Plane (HTTP)
     │
     ▼ (Response)
Telegram API
     │
     ▼
Telegram User
```

## Integration

### Upstream

| Source | Protocol | Purpose |
|--------|----------|---------|
| Telegram API | HTTPS (webhook) | Inbound updates |
| Telegram API | HTTPS (polling) | Inbound updates |

### Downstream

| Service | Protocol | Purpose |
|---------|----------|---------|
| Control Plane | HTTP | Message routing |
| Session Manager | HTTP | Session state |

### Update Types Handled

| Type | Action |
|------|--------|
| message | Process text/media messages |
| edited_message | Handle message edits |
| callback_query | Handle inline keyboard |
| my_chat_member | Bot added/removed from chat |
| channel_post | Channel messages |

## Configuration

### Environment Variables

```bash
# Server
CHANNEL_PORT=3000

# Telegram
TELEGRAM_BOT_TOKEN=      # Set via secret
TELEGRAM_API_URL=https://api.telegram.org
TELEGRAM_WEBHOOK_PATH=/webhook
TELEGRAM_WEBHOOK_URL=    # Public URL for webhooks
TELEGRAM_LONG_POLLING_TIMEOUT=60

# Service URLs
CONTROL_PLANE_URL=http://control-plane:8080
SESSION_MANAGER_URL=http://session-manager:3001
```

### Bot Commands

Common commands to register:
- `/start` - Start conversation
- `/help` - Show help
- `/status` - Show status

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: channel-telegram
spec:
  replicas: 2
  selector:
    matchLabels:
      app: channel-telegram
  template:
    spec:
      containers:
      - name: channel-telegram
        image: openclaw/channel-telegram:2026.2.26
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
        - name: TELEGRAM_BOT_TOKEN
          valueFrom:
            secretKeyRef:
              name: channel-credentials
              key: telegram-bot-token
        - name: TELEGRAM_WEBHOOK_URL
          value: https://telegram.openclaw.local/webhook
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: channel-telegram
spec:
  rules:
  - host: telegram.openclaw.local
    http:
      paths:
      - path: /webhook
        pathType: Prefix
        backend:
          service:
            name: channel-telegram
            port:
              number: 3000
```

## Testing

```bash
# Health check
curl http://localhost:3000/health

# Webhook test
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "message": {
      "chat": {"id": 123456789},
      "text": "Hello",
      "from": {"id": 987654321}
    }
  }'

# Set webhook (for testing)
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://your-url/webhook"
```

## Example Usage

### Send Message

```typescript
const result = await telegram.sendMessage({
  chat_id: '123456789',
  text: 'Hello from OpenClaw!',
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [{ text: 'Yes', callback_data: 'yes' }],
      [{ text: 'No', callback_data: 'no' }]
    ]
  }
});
```

### Handle Inbound Message

```typescript
// Format: InboundMessage
{
  channel: 'telegram',
  channelMessageId: 'msg-123',
  channelUserId: 'telegram:123456789',
  content: 'Hello bot!',
  timestamp: 1700000000000,
  metadata: {
    chatType: 'private',
    messageType: 'text'
  }
}
```

### Inline Keyboard

```typescript
const keyboard = {
  inline_keyboard: [
    [
      { text: 'Option 1', callback_data: 'opt1' },
      { text: 'Option 2', callback_data: 'opt2' }
    ],
    [
      { text: 'Visit Website', url: 'https://openclaw.ai' }
    ]
  ]
};
```

## Observability

- **Metrics**:
  - `telegram_messages_received_total`
  - `telegram_messages_sent_total`
  - `telegram_api_calls_total`
  - `telegram_webhook_updates_total`

- **Logs**: Structured JSON with Telegram chat IDs
- **Traces**: OpenTelemetry with chat context

## Telegram-Specific Features

### Bot Commands

```typescript
const commands = [
  { command: 'start', description: 'Start the bot' },
  { command: 'help', description: 'Get help' },
  { command: 'ask', description: 'Ask the AI' }
];
await bot.setMyCommands(commands);
```

### Media Messages

```typescript
// Send photo
await bot.sendPhoto(chatId, 'photo.jpg', {
  caption: 'Check this out!'
});

// Send document
await bot.sendDocument(chatId, 'file.pdf');
```

### Chat Types

- `private` - Direct messages
- `group` - Group chats
- `supergroup` - Supergroups
- `channel` - Channels
