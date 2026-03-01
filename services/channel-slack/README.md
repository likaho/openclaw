# Slack Channel Service

The Slack Channel Service is a microservice that handles all Slack messaging functionality. It connects to the Slack API using Bot Tokens, processes inbound events, and sends outbound messages.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Slack Users    │────▶│  Slack Channel │────▶│ Control Plane   │
│                 │     │   (Port 3000)   │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │  Slack API     │
                        │ (Events/Methods)│
                        └─────────────────┘
```

## Responsibilities

- **Slack Connection**: Connect via Slack Events API and Web API
- **Event Handling**: Process message, reaction, and app events
- **Message Sending**: Send messages to channels, DMs, threads
- **Interactive Components**: Handle buttons, menus, modals
- **Slash Commands**: Process Slack slash commands
- **OAuth**: Handle workspace installations

## Component Design

### Core Components

```
src/
├── index.ts          # Main entry point
├── config.ts         # Configuration
├── client/
│   ├── slack.ts      # Slack Web API client
│   ├── events.ts     # Events API handler
│   └── webhooks.ts  # Interactive endpoint
├── messages/
│   ├── inbound.ts   # Process incoming
│   ├── outbound.ts  # Send messages
│   └── transform.ts # Format conversion
├── handlers/
│   ├── message.ts   # Message handler
│   ├── reaction.ts  # Reaction handler
│   ├── command.ts   # Slash command handler
│   └── action.ts    # Interactive action handler
├── blocks/
│   ├── builder.ts   # Block Kit builder
│   └── elements.ts # UI elements
└── health.ts       # Health checks
```

### Slack Concepts

| Concept | Description |
|---------|-------------|
| Workspace | Slack workspace (team) |
| Channel | Public/private channels |
| Conversation | Thread or DM |
| Message | Text + blocks + attachments |
| Block | Visual component (section, actions, etc.) |
| Modal | Interactive popup dialog |

### Message Flow

```
Slack User
     │
     ▼ (Events API)
Slack Events Handler
     │
     ▼ (Verify Request)
Event Processor
     │
     ▼ (Transform)
Control Plane (HTTP)
     │
     ▼ (Response)
Slack Web API
     │
     ▼
Slack Channel/User
```

## Integration

### Upstream

| Source | Protocol | Purpose |
|--------|----------|---------|
| Slack Events API | HTTPS (webhook) | Event subscriptions |
| Slack Web API | HTTPS | Method calls |
| Slash Commands | HTTPS | Command requests |

### Downstream

| Service | Protocol | Purpose |
|---------|----------|---------|
| Control Plane | HTTP | Message routing |
| Session Manager | HTTP | Session state |

### Event Types Handled

| Event | Action |
|-------|--------|
| `message.channels` | Channel messages |
| `message.groups` | Private channel messages |
| `message.im` | DMs to bot |
| `message.mpim` | Group DMs |
| `app_mention` | @mentions |
| `reaction_added` | Reactions |
| `reaction_removed` | Reactions removed |

## Configuration

### Environment Variables

```bash
# Server
CHANNEL_PORT=3000

# Slack
SLACK_BOT_TOKEN=           # Set via secret (xoxb-...)
SLACK_SIGNING_SECRET=      # Set via secret
SLACK_APP_TOKEN=          # Set via secret (xapp-...)
SLACK_SOCKET_MODE=true

# Service URLs
CONTROL_PLANE_URL=http://control-plane:8080
SESSION_MANAGER_URL=http://session-manager:3001

# Slack-specific
SLACK_MAX_MESSAGE_LENGTH=30000
SLACK_RATE_LIMIT_DELAY=1000
```

### Required Scopes

Bot token scopes:
- `channels:read` - List channels
- `channels:history` - Read channel history
- `chat:write` - Send messages
- `reactions:write` - Add reactions
- `users:read` - User info
- `im:history` - DM history

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: channel-slack
spec:
  replicas: 2
  selector:
    matchLabels:
      app: channel-slack
  template:
    spec:
      containers:
      - name: channel-slack
        image: openclaw/channel-slack:2026.2.26
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
        - name: SLACK_BOT_TOKEN
          valueFrom:
            secretKeyRef:
              name: channel-credentials
              key: slack-bot-token
        - name: SLACK_SIGNING_SECRET
          valueFrom:
            secretKeyRef:
              name: channel-credentials
              key: slack-signing-secret
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: channel-slack
spec:
  rules:
  - host: slack.openclaw.local
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: channel-slack
            port:
              number: 3000
```

## Testing

```bash
# Health check
curl http://localhost:3000/health

# Events endpoint
curl -X POST http://localhost:3000/events \
  -H "Content-Type: application/json" \
  -d '{
    "type": "url_verification",
    "challenge": "test_challenge"
  }'

# Interactive endpoint
curl -X POST http://localhost:3000/interactive \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d 'payload={...}'
```

## Example Usage

### Send Message

```typescript
const result = await slack.client.chat.postMessage({
  channel: 'C1234567890',
  text: 'Hello from OpenClaw!',
  blocks: [
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: 'Hello from *OpenClaw*!'
      }
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: { type: 'plain_text', text: 'Ask AI' },
          action_id: 'ask_ai',
          value: 'start_conversation'
        }
      ]
    }
  ]
});
```

### Handle Inbound Message

```typescript
// Format: InboundMessage
{
  channel: 'slack',
  channelMessageId: 'msg-123',
  channelUserId: 'U1234567890',
  channelChannelId: 'C1234567890',
  content: 'Hello bot!',
  timestamp: '1700000000.123456',
  metadata: {
    channelType: 'channel',
    threadTs: '1700000000.123456'
  }
}
```

### Block Kit Examples

```typescript
// Section with button
const sectionWithButton = {
  type: 'section',
  text: {
    type: 'mrkdwn',
    text: 'Ask me anything!'
  },
  accessory: {
    type: 'button',
    text: { type: 'plain_text', text: 'Ask' },
    action_id: 'ask_button'
  }
};

// Input block with select
const inputBlock = {
  type: 'input',
  label: { type: 'plain_text', text: 'Select option' },
  element: {
    type: 'static_select',
    action_id: 'select_option',
    options: [
      { text: { type: 'plain_text', text: 'Option 1' }, value: '1' },
      { text: { type: 'plain_text', text: 'Option 2' }, value: '2' }
    ]
  }
};
```

## Observability

- **Metrics**:
  - `slack_messages_received_total`
  - `slack_messages_sent_total`
  - `slack_api_calls_total`
  - `slack_events_processed_total`

- **Logs**: Structured JSON with Slack conversation/user IDs
- **Traces**: OpenTelemetry with conversation context

## Slack-Specific Features

### Slash Commands

```typescript
// Register command: /ask
// Request URL: POST /commands
app.command('/ask', async ({ command, ack, respond }) => {
  await ack();
  // Process command
  await respond(`Processing: ${command.text}`);
});
```

### Interactive Components

```typescript
// Handle button click
app.action('ask_ai', async ({ action, ack, say }) => {
  await ack();
  await say(`Starting conversation...`);
});
```

### Modal Dialogs

```typescript
// Open modal
await client.views.open({
  trigger_id: trigger_id,
  view: {
    type: 'modal',
    title: { type: 'plain_text', text: 'Ask AI' },
    blocks: [...],
    submit: { type: 'plain_text', text: 'Submit' }
  }
});
```
