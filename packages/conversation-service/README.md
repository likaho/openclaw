# Conversation Service

Enterprise conversation service that provides:

- tenant-scoped conversation memory records with retention
- provider proxy policy checks with per-tenant key references
- immutable audit stream with hash-chain verification

## Run

```bash
pnpm --filter @openclaw/conversation-service start
```

## API surface

- `POST /v1/conversations/memory/entries`
- `GET /v1/conversations/memory/:tenantId/:conversationId`
- `POST /v1/providers/proxy`
- `POST /v1/audit/events`
- `GET /v1/audit/events/:tenantId`
- `GET /v1/audit/verify/:tenantId`
