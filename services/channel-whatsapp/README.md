# WhatsApp Channel Service

The WhatsApp Channel Service is a microservice that handles all WhatsApp messaging functionality. It connects to the WhatsApp Business API (Cloud API or on-premise), processes inbound messages, and sends outbound messages.

## Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│ WhatsApp Users  │────▶│WhatsApp Channel │────▶│ Control Plane   │
│                 │     │   (Port 3000)   │     │                 │
└─────────────────┘     └────────┬────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ WhatsApp API    │
                        │ (Cloud API)     │
                        └─────────────────┘
```

## Responsibilities

- **WhatsApp Connection**: Connect via WhatsApp Cloud API or on-premise API
- **Message Handling**: Receive and process inbound messages
- **Message Sending**: Send text, media, template messages
- **Webhook Verification**: Verify and process webhooks
- **Template Management**: Manage message templates
- **Media Handling**: Download and upload media files

## Component Design

### Core Components

```
src/
├── index.ts          # Main entry point
├── config.ts         # Configuration
├── client/
│   ├── whatsapp.ts   # WhatsApp API client
│   ├── webhooks.ts  # Webhook handler
│   └── media.ts     # Media handling
├── messages/
│   ├── inbound.ts   # Process incoming
│   ├── outbound.ts  # Send messages
│   └── transform.ts # Format conversion
├── handlers/
│   ├── message.ts   # Message handler
│   ├── status.ts   # Status handler
│   └── callback.ts  # Callback handler
├── templates/
│   ├── manager.ts   # Template management
│   └── types.ts    # Template types
└── health.ts       # Health checks
```

### WhatsApp API Concepts

| Concept | Description |
|---------|-------------|
| Phone Number ID | Business phone number ID |
| WhatsApp Business Account | Business account |
| Template Message | Pre-approved message templates |
| Interactive Message | Interactive messages with buttons/lists |
| Media Message | Images, audio, video, documents |

### Message Flow

```
WhatsApp User
     │
     ▼ (Webhook)
WhatsApp Webhook Handler
     │
     ▼ (Verify Request)
Message Processor
     │
     ▼ (Transform)
Control Plane (HTTP)
     │
     ▼ (Response)
WhatsApp API
     │
     ▼
WhatsApp User
```

## Integration

### Upstream

| Source | Protocol | Purpose |
|--------|----------|---------|
| WhatsApp API | HTTPS (webhook) | Inbound messages |
| WhatsApp API | HTTPS | Outbound messages |

### Downstream

| Service | Protocol | Purpose |
|---------|----------|---------|
| Control Plane | HTTP | Message routing |
| Session Manager | HTTP | Session state |

### Message Types Handled

| Type | Direction | Description |
|------|-----------|-------------|
| text | Both | Text messages |
| image | Both | Image messages |
| audio | Both | Audio messages |
| video | Both | Video messages |
| document | Both | Document files |
| sticker | Both | Sticker messages |
| location | Both | Location messages |
| reaction | Both | Message reactions |
| interactive | Both | Interactive messages |
| template | Outbound | Template messages |

## Configuration

### Environment Variables

```bash
# Server
CHANNEL_PORT=3000

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=    # Set via secret
WHATSAPP_ACCESS_TOKEN=       # Set via secret (Meta Developer)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=  # Set via secret
WHATSAPP_BUSINESS_ACCOUNT_ID=
WHATSAPP_API_VERSION=v18.0

# Webhook
WEBHOOK_PATH=/webhook
WEBHOOK_VERIFY_TOKEN=       # Your verification token

# Service URLs
CONTROL_PLANE_URL=http://control-plane:8080
SESSION_MANAGER_URL=http://session-manager:3001

# Media
WHATSAPP_MAX_MEDIA_SIZE=16777216  # 16MB
WHATSAPP_MEDIA_DOWNLOAD_PATH=/tmp/media
```

### Required Permissions

In Meta Developer Portal:
- `whatsapp_business_management`
- `whatsapp_business_messaging`

## Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: channel-whatsapp
spec:
  replicas: 2
  selector:
    matchLabels:
      app: channel-whatsapp
  template:
    spec:
      containers:
      - name: channel-whatsapp
        image: openclaw/channel-whatsapp:2026.2.26
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
        - name: WHATSAPP_PHONE_NUMBER_ID
          valueFrom:
            secretKeyRef:
              name: channel-credentials
              key: whatsapp-phone-number-id
        - name: WHATSAPP_ACCESS_TOKEN
          valueFrom:
            secretKeyRef:
              name: channel-credentials
              key: whatsapp-access-token
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: channel-whatsapp
spec:
  rules:
  - host: whatsapp.openclaw.local
    http:
      paths:
      - path: /webhook
        pathType: Prefix
        backend:
          service:
            name: channel-whatsapp
            port:
              number: 3000
```

## Testing

```bash
# Health check
curl http://localhost:3000/health

# Webhook verification
curl "http://localhost:3000/webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=TEST_CHALLENGE"

# Test inbound message
curl -X POST http://localhost:3000/webhook \
  -H "Content-Type: application/json" \
  -d '{
    "object": "whatsapp_business_account",
    "entry": [{
      "id": "WHATSAPP_BUSINESS_ACCOUNT_ID",
      "changes": [{
        "value": {
          "messaging_product": "whatsapp",
          "messages": [{
            "from": "1234567890",
            "id": "wamid.123",
            "text": {"body": "Hello"},
            "timestamp": "1700000000",
            "type": "text"
          }]
        }
      }]
    }]
  }'
```

## Example Usage

### Send Text Message

```typescript
const result = await whatsapp.sendMessage({
  to: '1234567890',
  type: 'text',
  text: {
    body: 'Hello from OpenClaw!'
  }
});
```

### Send Template Message

```typescript
const result = await whatsapp.sendMessage({
  to: '1234567890',
  type: 'template',
  template: {
    name: 'hello_world',
    language: { code: 'en_US' }
  }
});
```

### Send Interactive Message

```typescript
const result = await whatsapp.sendMessage({
  to: '1234567890',
  type: 'interactive',
  interactive: {
    type: 'button',
    body: {
      text: 'What would you like to do?'
    },
    action: {
      buttons: [
        { type: 'reply', reply: { id: 'ask_ai', title: 'Ask AI' } },
        { type: 'reply', reply: { id: 'get_help', title: 'Get Help' } }
      ]
    }
  }
});
```

### Handle Inbound Message

```typescript
// Format: InboundMessage
{
  channel: 'whatsapp',
  channelMessageId: 'wamid.123',
  channelUserId: 'whatsapp:1234567890',
  content: 'Hello bot!',
  timestamp: 1700000000,
  metadata: {
    messageType: 'text',
    conversationType: 'individual'
  }
}
```

## Message Types

### Text Messages

```typescript
{
  type: 'text',
  text: { body: 'Hello!' }
}
```

### Media Messages

```typescript
// Image
{
  type: 'image',
  image: { id: '<IMAGE_ID>' }
}

// Audio
{
  type: 'audio',
  audio: { id: '<AUDIO_ID>' }
}

// Document
{
  type: 'document',
  document: { id: '<DOC_ID>', filename: 'file.pdf' }
}
```

### Interactive Messages

```typescript
// List Message
{
  type: 'interactive',
  interactive: {
    type: 'list',
    header: { type: 'text', text: 'Select option' },
    body: { text: 'Choose from the list' },
    footer: { text: 'Powered by OpenClaw' },
    action: {
      button: 'View Options',
      sections: [{
        title: 'Categories',
        rows: [
          { id: '1', title: 'Support', description: 'Get help' },
          { id: '2', title: 'Sales', description: 'Talk to sales' }
        ]
      }]
    }
  }
}
```

## Observability

- **Metrics**:
  - `whatsapp_messages_received_total`
  - `whatsapp_messages_sent_total`
  - `whatsapp_template_messages_total`
  - `whatsapp_media_downloads_total`

- **Logs**: Structured JSON with WhatsApp phone numbers
- **Traces**: OpenTelemetry with phone number context

## WhatsApp-Specific Features

### Template Messages

Pre-approved templates required for:
- Initial customer outreach
- Transactional notifications
- Reminders

Example template:
```
Hello {{1}}, thank you for contacting us. How can we help you today?
```

### Media Handling

```typescript
// Download media
const mediaUrl = await whatsapp.getMediaUrl(mediaId);
const mediaData = await whatsapp.downloadMedia(mediaUrl);

// Upload media
const mediaId = await whatsapp.uploadMedia({
  type: 'image',
  mimeType: 'image/jpeg',
  data: Buffer
});
```

### Status Webhooks

```typescript
// Handle delivery status
{
  status: 'sent',      // Message sent
  status: 'delivered',  // Message delivered
  status: 'read',       // Message read
  status: 'failed'     // Message failed
}
```
